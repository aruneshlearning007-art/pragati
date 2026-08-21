-- Content scoping changed: every class (3-8) is now school-scoped, not
-- just Class 3-5 -- each school owns and curates its own content, never
-- shared across schools even for the standardized Class 6-8 curriculum.
-- Backfill schoolId for existing Class 6-8 chapters that were created
-- under the old board-scoped rule (schoolId was intentionally left null
-- at the time). Only touches teacher-uploaded chapters -- system-seeded
-- chapters (no teacherId) have no real owning school and stay null.
UPDATE "Chapter" c
SET "schoolId" = u."schoolId"
FROM "User" u
WHERE c."teacherId" = u.id
  AND c."schoolId" IS NULL
  AND u."schoolId" IS NOT NULL;
