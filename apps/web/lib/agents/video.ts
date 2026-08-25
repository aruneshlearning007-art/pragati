import { prisma } from "@pragati/db";
import { generate, extractJson } from "@pragati/shared";

export interface VideoView {
  id: string;
  title: string;
  url: string;
  duration: string;
}

const MAX_VIDEOS = 3;
// Search more candidates than we need so the ranking pass below has real
// choice — without this, a bad top-3 from YouTube's own keyword relevance
// has nothing better to fall back to.
const CANDIDATE_POOL_SIZE = 10;

interface Candidate {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  duration: string;
  viewCount: number;
}

/**
 * Video Curator Agent — still no LLM call generates a video (a hallucinated
 * link would be worse than none), but an LLM now ranks/filters real YouTube
 * search results before caching, since keyword search alone had two real
 * gaps: no guarantee the result actually matches this specific concept at
 * this class level (YouTube's relevance ranking treats "Class 6" as just
 * another keyword), and no quality signal at all (a low-effort video and a
 * well-produced one ranked identically as long as the keywords hit).
 * Results stay topic-scoped only (not per board/class/language like Notes/
 * Explanation) and are cached in the Video table once curated.
 */
export async function getOrCurateVideos(
  topicId: string,
  subjectName: string,
  topicTitle: string,
  studentClass: string,
  board?: string,
): Promise<VideoView[]> {
  const existing = await prisma.video.findMany({ where: { topicId }, orderBy: { order: "asc" } });
  if (existing.length > 0) {
    return existing.map((v) => ({ id: v.id, title: decodeHtmlEntities(v.title), url: v.url, duration: v.duration }));
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not set");
  }

  const query = `${topicTitle} ${subjectName} ${studentClass} ${board ?? ""} explanation`.trim();
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true` +
    `&videoDuration=medium&maxResults=${CANDIDATE_POOL_SIZE}&safeSearch=strict&relevanceLanguage=en` +
    `&q=${encodeURIComponent(query)}&key=${apiKey}`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`YouTube search API error ${searchRes.status}: ${await searchRes.text()}`);
  }
  const searchData = (await searchRes.json()) as {
    items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string; description: string } }[];
  };
  const items = searchData.items ?? [];
  if (items.length === 0) return [];

  const videoIds = items.map((i) => i.id.videoId).join(",");
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) {
    throw new Error(`YouTube videos API error ${detailsRes.status}: ${await detailsRes.text()}`);
  }
  const detailsData = (await detailsRes.json()) as {
    items?: { id: string; contentDetails: { duration: string }; statistics?: { viewCount?: string } }[];
  };
  const detailsById = new Map((detailsData.items ?? []).map((d) => [d.id, d]));

  const candidates: Candidate[] = items
    .map((item) => {
      const details = detailsById.get(item.id.videoId);
      return {
        videoId: item.id.videoId,
        title: decodeHtmlEntities(item.snippet.title),
        channelTitle: item.snippet.channelTitle,
        description: item.snippet.description.slice(0, 200),
        duration: details ? formatIsoDuration(details.contentDetails.duration) : "",
        viewCount: details?.statistics?.viewCount ? parseInt(details.statistics.viewCount, 10) : 0,
      };
    })
    // A video the details call couldn't find (e.g. taken down between the
    // two calls) has no usable duration — drop it rather than show a blank.
    .filter((c) => c.duration);

  const selected = await rankAndSelectVideos(candidates, topicTitle, subjectName, studentClass, board);

  const created = await Promise.all(
    selected.map((c, index) =>
      prisma.video.create({
        data: {
          topicId,
          title: c.title,
          url: `https://www.youtube.com/watch?v=${c.videoId}`,
          duration: c.duration,
          order: index,
        },
      }),
    ),
  );

  return created.map((v) => ({ id: v.id, title: v.title, url: v.url, duration: v.duration }));
}

/**
 * Picks the best MAX_VIDEOS candidates for this specific concept and class
 * level, and screens out anything that looks like low-effort or off-topic
 * content going by its title/channel/description — judging only metadata
 * of real search results, never inventing a video. Falls back to the first
 * MAX_VIDEOS candidates (YouTube's own relevance order) if the ranking call
 * fails or returns something unusable, so one bad LLM response never breaks
 * the whole Videos tab.
 */
async function rankAndSelectVideos(
  candidates: Candidate[],
  topicTitle: string,
  subjectName: string,
  studentClass: string,
  board?: string,
): Promise<Candidate[]> {
  const fallback = candidates.slice(0, MAX_VIDEOS);
  if (candidates.length <= MAX_VIDEOS) return fallback;

  try {
    const system =
      "You are helping choose YouTube videos for a school student to learn a specific concept. You will be given " +
      "a list of real candidate videos (title, channel, description snippet, duration, view count) found by a " +
      "keyword search - you are NOT generating or inventing any video, only selecting from this exact list. " +
      "Pick the videos that best satisfy ALL of these: (1) the video is genuinely about this specific concept, " +
      "not just a loosely related or broader topic; (2) it is pitched at the right depth for this class/grade " +
      "level - not too advanced (e.g. college-level) or too basic; (3) based on its title, channel, and " +
      "description, it looks like a real, well-explained educational video, not a song, prank, vlog, exam-tips-" +
      "only, or clickbait video with no real teaching content. Prefer videos from well-known educational " +
      "channels when quality otherwise seems similar. Order your picks best-first.\n" +
      'Respond ONLY with strict JSON, no markdown: {"selectedVideoIds":["string", ...]}. ' +
      "Only include ids from the candidate list, and include no more than " +
      MAX_VIDEOS +
      " ids. If fewer than " +
      MAX_VIDEOS +
      " candidates genuinely qualify, return fewer rather than padding with a bad one.";

    const userContent =
      `Concept: ${topicTitle}\nSubject: ${subjectName}\nClass: ${studentClass}${board ? `\nBoard: ${board}` : ""}\n\n` +
      `Candidate videos:\n${candidates
        .map(
          (c, i) =>
            `${i + 1}. id="${c.videoId}" | title="${c.title}" | channel="${c.channelTitle}" | duration=${c.duration} | ` +
            `views=${c.viewCount} | description="${c.description}"`,
        )
        .join("\n")}`;

    const raw = await generate({ system, messages: [{ role: "user", content: userContent }], json: true });
    const parsed = extractJson<{ selectedVideoIds?: string[] }>(raw);
    const ids = (parsed.selectedVideoIds ?? []).slice(0, MAX_VIDEOS);

    const byId = new Map(candidates.map((c) => [c.videoId, c]));
    const selected = ids.map((id) => byId.get(id)).filter((c): c is Candidate => c !== undefined);

    return selected.length > 0 ? selected : fallback;
  } catch {
    // Ranking is a best-effort quality improvement, not something a
    // student's Videos tab should ever go blank over.
    return fallback;
  }
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

/** YouTube API titles/descriptions are HTML-encoded; decode the common entities before storing. */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(amp|#39|quot|lt|gt);/g, (m) => HTML_ENTITIES[m] ?? m);
}

/** "PT12M34S" -> "12:34" */
function formatIsoDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
