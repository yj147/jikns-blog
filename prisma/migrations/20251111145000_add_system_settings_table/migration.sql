-- CreateTable
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "key" text NOT NULL,
    "value" jsonb NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "updatedById" uuid,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");

ALTER TABLE "system_settings"
  ADD CONSTRAINT "system_settings_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
