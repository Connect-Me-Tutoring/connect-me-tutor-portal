ALTER TABLE "Emails" RENAME to session_reminders;

CREATE VIEW "Emails" WITH (security_invoker = true) AS
SELECT * FROM session_reminders;

CREATE TABLE emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    recipient_email text NOT NULL,
    subject text,
    content text
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for authenticated users"
ON emails
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users"
ON emails
FOR SELECT
TO authenticated
USING (true);

