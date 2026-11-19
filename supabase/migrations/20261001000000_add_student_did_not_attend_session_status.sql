-- Add 'Student Did Not Attend' to session_status enum
ALTER TYPE "public"."session_status" ADD VALUE IF NOT EXISTS 'Student Did Not Attend';
