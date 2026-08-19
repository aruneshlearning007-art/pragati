-- CreateTable
CREATE TABLE "TopicImage" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "credit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicImage_topicId_idx" ON "TopicImage"("topicId");

-- AddForeignKey
ALTER TABLE "TopicImage" ADD CONSTRAINT "TopicImage_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
