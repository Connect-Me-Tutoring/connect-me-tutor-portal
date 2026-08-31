-- Convert "Profiles".status from free-text to a proper enum.
-- Prod data audited 2026-08-30: only 'Active' (2386), 'Inactive' (7), and null (3) exist.

CREATE TYPE "public"."profile_status" AS ENUM (
    'Active',
    'Inactive'
);

ALTER TYPE "public"."profile_status" OWNER TO "postgres";

UPDATE "public"."Profiles" SET "status" = 'Active' WHERE "status" IS NULL;

ALTER TABLE "public"."Profiles"
    ALTER COLUMN "status" TYPE "public"."profile_status" USING "status"::"public"."profile_status",
    ALTER COLUMN "status" SET NOT NULL;
