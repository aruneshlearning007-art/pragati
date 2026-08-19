import { prisma } from "@pragati/db";

export interface VideoView {
  id: string;
  title: string;
  url: string;
  duration: string;
}

const MAX_VIDEOS = 3;

/**
 * Video Curator Agent — no LLM call. Searches real YouTube videos for a
 * topic via the YouTube Data API and caches the results in the Video table
 * (topic-scoped only, not per board/class/language like Notes/Explanation —
 * a real-world video isn't curriculum-scoped the same way).
 */
export async function getOrCurateVideos(
  topicId: string,
  subjectName: string,
  topicTitle: string,
  studentClass: string,
): Promise<VideoView[]> {
  const existing = await prisma.video.findMany({ where: { topicId }, orderBy: { order: "asc" } });
  if (existing.length > 0) {
    return existing.map((v) => ({ id: v.id, title: v.title, url: v.url, duration: v.duration }));
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not set");
  }

  const query = `${topicTitle} ${subjectName} ${studentClass} explanation`;
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true` +
    `&maxResults=${MAX_VIDEOS}&safeSearch=strict&relevanceLanguage=en&q=${encodeURIComponent(query)}&key=${apiKey}`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`YouTube search API error ${searchRes.status}: ${await searchRes.text()}`);
  }
  const searchData = (await searchRes.json()) as {
    items?: { id: { videoId: string }; snippet: { title: string } }[];
  };
  const items = searchData.items ?? [];
  if (items.length === 0) return [];

  const videoIds = items.map((i) => i.id.videoId).join(",");
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) {
    throw new Error(`YouTube videos API error ${detailsRes.status}: ${await detailsRes.text()}`);
  }
  const detailsData = (await detailsRes.json()) as {
    items?: { id: string; contentDetails: { duration: string } }[];
  };
  const durationByVideoId = new Map(
    (detailsData.items ?? []).map((d) => [d.id, formatIsoDuration(d.contentDetails.duration)]),
  );

  const created = await Promise.all(
    items.map((item, index) =>
      prisma.video.create({
        data: {
          topicId,
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          duration: durationByVideoId.get(item.id.videoId) ?? "",
          order: index,
        },
      }),
    ),
  );

  return created.map((v) => ({ id: v.id, title: v.title, url: v.url, duration: v.duration }));
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
