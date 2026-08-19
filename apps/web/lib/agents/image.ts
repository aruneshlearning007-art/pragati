import { prisma } from "@pragati/db";

export interface TopicImageView {
  url: string;
  caption: string;
  credit: string | null;
}

type CommonsPage = {
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    extmetadata?: { ImageDescription?: { value: string }; Artist?: { value: string } };
  }[];
};

/**
 * Image Curator — no LLM call, no generation. Searches real, existing
 * diagrams/photos on Wikimedia Commons (the same media library behind
 * Wikipedia) and caches the first safe, relevant hit. Topic-scoped only,
 * same reasoning as Video — a real diagram isn't board/class/language-scoped.
 */
const STOPWORDS = new Set(["and", "the", "with", "for", "from", "into", "onto", "your", "this", "that"]);

/** Words worth requiring a title match on — drops short/common words like "and". */
function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export async function getOrCurateImage(
  topicId: string,
  subjectName: string,
  topicTitle: string,
): Promise<TopicImageView | null> {
  const existing = await prisma.topicImage.findFirst({ where: { topicId }, orderBy: { createdAt: "asc" } });
  if (existing) {
    return { url: existing.url, caption: existing.caption, credit: existing.credit };
  }

  // Commons' full-text search matches keywords anywhere in a file's rich
  // prose description — a query for "Shadows and Reflections Science" once
  // returned an Apollo moon-landing photo because its caption happened to
  // mention "reflection" and "shadow" in passing. Relevance requires the
  // MATCH to be in the file's own title (how contributors actually labeled
  // the image), which is far more precise than description text.
  const topicWords = significantWords(topicTitle);

  // Commons' search also effectively ANDs every term, so the most specific
  // query (topic + subject + "diagram") can easily return zero hits for a
  // multi-word topic title — try it first, then fall back to progressively
  // looser queries, still gated by the title-relevance check above.
  const queryCandidates = [
    `${topicTitle} ${subjectName} diagram`,
    `${topicTitle} ${subjectName}`,
    topicTitle,
  ];

  let firstUsable: CommonsPage | undefined;
  for (const base of queryCandidates) {
    const pages = await searchCommons(`${base} filetype:bitmap|drawing`);
    firstUsable = pages.find((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return false;
      // Check the ORIGINAL file's extension, not the thumbnail's — a scanned
      // PDF/djvu still gets a .jpg thumbnail rendering of its first page, so
      // thumburl alone doesn't catch it. filetype:bitmap|drawing in the query
      // already excludes these; this is a defense-in-depth backstop.
      const url = info.url.split("?")[0].toLowerCase();
      if (!/\.(jpe?g|png|gif|svg)$/.test(url)) return false;

      const title = p.title.toLowerCase();
      return topicWords.some((w) => title.includes(w));
    });
    if (firstUsable) break;
  }
  if (!firstUsable) return null;

  const info = firstUsable.imageinfo![0];
  const rawDescription = info.extmetadata?.ImageDescription?.value ?? firstUsable.title.replace(/^File:/, "");
  const caption = stripHtml(rawDescription).slice(0, 200);
  const credit = info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value).slice(0, 100) : null;

  const created = await prisma.topicImage.create({
    data: { topicId, url: info.thumburl ?? info.url, caption: caption || firstUsable.title, credit },
  });

  return { url: created.url, caption: created.caption, credit: created.credit };
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

async function searchCommons(query: string): Promise<CommonsPage[]> {
  const searchUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`;

  const res = await fetch(searchUrl, { headers: { "User-Agent": "Pragati-EdTech-App/1.0 (pilot)" } });
  if (!res.ok) {
    throw new Error(`Wikimedia Commons API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  return Object.values(data.query?.pages ?? {});
}
