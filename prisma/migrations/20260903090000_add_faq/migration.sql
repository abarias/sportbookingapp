CREATE TABLE "FaqTopic" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaqTopic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaqTopic_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "FaqTopic_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "FaqTopic_displayOrder_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "FaqItem" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" JSONB NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaqItem_question_check" CHECK (length(btrim("question")) > 0),
  CONSTRAINT "FaqItem_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "FaqItem_displayOrder_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "FaqItem_answer_check" CHECK (
    jsonb_typeof("answer") = 'object'
    AND "answer" ? 'version' AND "answer"->>'version' = '1'
    AND "answer" ? 'blocks'
    AND CASE WHEN jsonb_typeof("answer"->'blocks') = 'array'
      THEN jsonb_array_length("answer"->'blocks') > 0 ELSE false END
  ),
  CONSTRAINT "FaqItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "FaqTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FaqTopic_slug_key" ON "FaqTopic"("slug");
CREATE UNIQUE INDEX "FaqItem_topicId_slug_key" ON "FaqItem"("topicId", "slug");
CREATE INDEX "FaqTopic_isPublished_displayOrder_slug_idx" ON "FaqTopic"("isPublished", "displayOrder", "slug");
CREATE INDEX "FaqItem_topicId_isPublished_displayOrder_slug_idx" ON "FaqItem"("topicId", "isPublished", "displayOrder", "slug");

ALTER TABLE "FaqTopic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FaqItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "FaqTopic", "FaqItem" FROM PUBLIC;

-- Policies grant no privileges themselves. Only read privileges are granted
-- to the Supabase browser roles below; writes stay with the trusted server.
CREATE POLICY "FaqTopic_published_read" ON "FaqTopic" FOR SELECT
  USING ("isPublished" = true);
CREATE POLICY "FaqItem_published_read" ON "FaqItem" FOR SELECT
  USING ("isPublished" = true AND EXISTS (
    SELECT 1 FROM "FaqTopic" topic WHERE topic."id" = "FaqItem"."topicId" AND topic."isPublished" = true
  ));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "FaqTopic", "FaqItem" FROM anon;
    GRANT SELECT ON TABLE "FaqTopic", "FaqItem" TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "FaqTopic", "FaqItem" FROM authenticated;
    GRANT SELECT ON TABLE "FaqTopic", "FaqItem" TO authenticated;
  END IF;
END
$$;
