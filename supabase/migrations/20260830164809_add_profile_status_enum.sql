
CREATE TYPE "public"."profile_status" AS ENUM (
    'Active',
    'Inactive'
);

ALTER TYPE "public"."profile_status" OWNER TO "postgres";

UPDATE "public"."Profiles" SET "status" = 'Active' WHERE "status" IS NULL;

ALTER TABLE "public"."Profiles"
    ALTER COLUMN "status" TYPE "public"."profile_status" USING "status"::"public"."profile_status",
    ALTER COLUMN "status" SET NOT NULL;
