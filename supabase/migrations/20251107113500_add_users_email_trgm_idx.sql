-- Improve fuzzy search performance for user emails
CREATE INDEX IF NOT EXISTS "users_email_trgm_idx"
  ON "public"."users" USING GIN ("email" gin_trgm_ops);
