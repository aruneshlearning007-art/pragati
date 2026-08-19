-- The Image Curator's first live run cached an irrelevant Wikimedia result
-- (an Apollo moon-landing photo matched on "reflection" appearing in its
-- description text, not its title) before the relevance filter was added.
-- Clear it so the next visit re-curates under the corrected logic.
DELETE FROM "TopicImage" WHERE "topicId" = 'seed-topic-shadows-reflections';
