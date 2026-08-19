import { prisma } from "@pragati/db";

export interface TopicImageView {
  url: string;
  caption: string;
  credit: string | null;
}

/**
 * Image Curator — no LLM call, no generation. Searches real, existing
 * diagrams/photos on Wikimedia Commons (the same media library behind
 * Wikipedia) and caches the first safe, relevant hit. Topic-scoped only,
 * same reasoning as Video — a real diagram isn't board/class/language-scoped.
 */
export async function getOrCurateImage(
  topicId: string,
  subjectName: string,
  topicTitle: string,
): Promise<TopicImageView | null> {
  const existing = await prisma.topicImage.findFirst({ where: { topicId }, orderBy: { createdAt: "asc" } });
  if (existing) {
    return { url: existing.url, caption: existing.caption, credit: existing.credit };
  }

  // filetype:bitmap|drawing excludes scanned-book/PDF/djvu results that
  // Commons' full-text search otherwise happily matches on OCR'd body text —
  // without it, a query like "light reflection diagram" returns 19th-century
  // book scans, not actual diagrams.
  const query = `${topicTitle} ${subjectName} diagram filetype:bitmap|drawing`;
  const searchUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`;

  const res = await fetch(searchUrl, { headers: { "User-Agent": "Pragati-EdTech-App/1.0 (pilot)" } });
  if (!res.ok) {
    throw new Error(`Wikimedia Commons API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: {
            url: string;
            thumburl?: string;
            extmetadata?: { ImageDescription?: { value: string }; Artist?: { value: string } };
          }[];
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages ?? {});
  const firstUsable = pages.find((p) => {
    const info = p.imageinfo?.[0];
    if (!info) return false;
    // Check the ORIGINAL file's extension, not the thumbnail's — a scanned
    // PDF/djvu still gets a .jpg thumbnail rendering of its first page, so
    // thumburl alone doesn't catch it. filetype:bitmap|drawing in the query
    // already excludes these; this is a defense-in-depth backstop.
    const url = info.url.split("?")[0].toLowerCase();
    return /\.(jpe?g|png|gif|svg)$/.test(url);
  });
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
