-- Seed taxonomy for the Phase 1 demo slice: one subject, one chapter, one
-- topic, two sub-concepts. Content (Notes/Explain/Quiz) is generated on
-- first student visit by the agents, not seeded here.
INSERT INTO "Subject" (id, "nameEn", "nameHi", "createdAt")
VALUES ('seed-subject-science', 'Science', 'विज्ञान', now())
ON CONFLICT ("nameEn") DO NOTHING;

INSERT INTO "Chapter" (id, "subjectId", "titleEn", "titleHi", class, board, "createdAt")
VALUES ('seed-chapter-light', 'seed-subject-science', 'Light', 'प्रकाश', 'Class 6', 'CBSE', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Topic" (id, "chapterId", "titleEn", "titleHi", "createdAt")
VALUES ('seed-topic-shadows-reflections', 'seed-chapter-light', 'Shadows and Reflections', 'छाया और परावर्तन', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "SubConcept" (id, "topicId", name)
VALUES
  ('seed-subconcept-shadow-formation', 'seed-topic-shadows-reflections', 'Shadow formation'),
  ('seed-subconcept-reflection-angles', 'seed-topic-shadows-reflections', 'Reflection angles')
ON CONFLICT (id) DO NOTHING;
