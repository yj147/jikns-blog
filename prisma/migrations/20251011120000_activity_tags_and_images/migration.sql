-- Phase 6 follow-up: normalize Activity image storage and introduce structured tags

-- 1) Convert imageUrls from JSON to TEXT[] with empty-array default
ALTER TABLE activities
  ALTER COLUMN "imageUrls" TYPE text[]
  USING CASE
    WHEN "imageUrls" IS NULL THEN ARRAY[]::text[]
    WHEN jsonb_typeof("imageUrls") = 'array' THEN COALESCE(
      (SELECT array_agg(value) FROM jsonb_array_elements_text("imageUrls") AS value),
      ARRAY[]::text[]
    )
    ELSE ARRAY[]::text[]
  END;

ALTER TABLE activities
  ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::text[];

ALTER TABLE activities
  ALTER COLUMN "imageUrls" SET NOT NULL;

-- 2) Activity ↔ Tag association table
CREATE TABLE activity_tags (
  "activityId" text NOT NULL,
  "tagId" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_tags_pkey PRIMARY KEY ("activityId", "tagId"),
  CONSTRAINT activity_tags_activity_fkey FOREIGN KEY ("activityId") REFERENCES activities("id") ON DELETE CASCADE,
  CONSTRAINT activity_tags_tag_fkey FOREIGN KEY ("tagId") REFERENCES tags("id") ON DELETE CASCADE
);

CREATE INDEX idx_activity_tags_activity ON activity_tags("activityId");
CREATE INDEX idx_activity_tags_tag ON activity_tags("tagId");

-- 3) Full-text search index on content to align with Prisma search operator
CREATE INDEX idx_activities_content_search
  ON activities
  USING GIN (to_tsvector('simple', coalesce(content, '')));
