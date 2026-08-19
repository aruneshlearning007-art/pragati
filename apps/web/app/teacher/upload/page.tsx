import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";
import { UploadChapterForm } from "@/components/UploadChapterForm";
import type { Language } from "@/lib/i18n";

export default async function UploadChapterPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;
  const language = (teacher.language as Language) ?? "en";

  const subjects = await prisma.subject.findMany({ orderBy: { nameEn: "asc" } });

  return (
    <div className="max-w-2xl">
      <UploadChapterForm subjects={subjects.map((s) => ({ id: s.id, name: s.nameEn }))} language={language} />
    </div>
  );
}
