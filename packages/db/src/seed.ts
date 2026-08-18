import { prisma } from "./index";

// Seeds the taxonomy only (Subject/Chapter/Topic/SubConcept) — never fake
// Notes/Explain/Quiz content. Real content is generated on first access by
// the agents and cached, matching how the app behaves for teacher-uploaded
// chapters too.
async function main() {
  const science = await prisma.subject.upsert({
    where: { nameEn: "Science" },
    update: {},
    create: { nameEn: "Science", nameHi: "विज्ञान" },
  });

  const lightChapter = await prisma.chapter.upsert({
    where: { id: "seed-chapter-light" },
    update: {},
    create: {
      id: "seed-chapter-light",
      subjectId: science.id,
      titleEn: "Light",
      titleHi: "प्रकाश",
      class: "Class 6",
      board: "CBSE",
    },
  });

  const topic = await prisma.topic.upsert({
    where: { id: "seed-topic-shadows-reflections" },
    update: {},
    create: {
      id: "seed-topic-shadows-reflections",
      chapterId: lightChapter.id,
      titleEn: "Shadows and Reflections",
      titleHi: "छाया और परावर्तन",
    },
  });

  const subConcepts = ["Shadow formation", "Reflection angles"];
  for (const name of subConcepts) {
    const existing = await prisma.subConcept.findFirst({
      where: { topicId: topic.id, name },
    });
    if (!existing) {
      await prisma.subConcept.create({ data: { topicId: topic.id, name } });
    }
  }

  console.log("Seed complete:", { science: science.id, lightChapter: lightChapter.id, topic: topic.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
