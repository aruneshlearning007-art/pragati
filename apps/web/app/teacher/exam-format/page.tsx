import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";
import { ExamFormatForm } from "@/components/ExamFormatForm";
import type { Language } from "@/lib/i18n";

export default async function ExamFormatPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;
  const language = (teacher.language as Language) ?? "en";

  const subjects = await prisma.subject.findMany({ orderBy: { nameEn: "asc" } });

  return (
    <div className="max-w-3xl">
      <ExamFormatForm subjects={subjects.map((s) => ({ id: s.id, name: s.nameEn }))} language={language} />
    </div>
  );
}
