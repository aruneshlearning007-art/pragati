import { UI, type Language } from "@/lib/i18n";

interface VideoView {
  id: string;
  title: string;
  url: string;
  duration: string;
}

function toEmbedUrl(url: string): string {
  const videoId = url.split("v=")[1]?.split("&")[0];
  return `https://www.youtube.com/embed/${videoId}`;
}

export function VideosTab({ videos, language }: { videos: VideoView[]; language: Language }) {
  const t = UI[language];

  if (videos.length === 0) {
    return <p style={{ color: "var(--color-text-muted)" }}>{t.noVideosFound}</p>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {videos.map((v) => (
        <div
          key={v.id}
          className="rounded-card overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={toEmbedUrl(v.url)}
              title={v.title}
              className="w-full h-full"
              style={{ border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="text-[13.5px] font-semibold leading-snug">{v.title}</div>
            {v.duration && (
              <div className="text-xs flex-none" style={{ color: "var(--color-text-muted)" }}>
                {v.duration}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
