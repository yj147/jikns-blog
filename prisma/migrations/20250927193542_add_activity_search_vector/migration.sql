-- Phase 6 / T6: introduce full-text search support for activities

ALTER TABLE activities
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(content, '')), 'A')
  ) STORED;

CREATE INDEX idx_activities_search_vector
  ON activities USING GIN (search_vector);
