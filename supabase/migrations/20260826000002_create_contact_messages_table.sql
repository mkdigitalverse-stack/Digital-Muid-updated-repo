-- =========================================================================
-- DIGITAL MUID — STEP 3F MIGRATION: CONTACT MESSAGES TABLE & RLS
-- =========================================================================

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone VARCHAR(30),
  inquiry_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages (email);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Anonymous users may INSERT their inquiries only
CREATE POLICY "Public Insert Contact Messages"
ON contact_messages
FOR INSERT
WITH CHECK (true);

-- Authenticated Admin has full access to read, update, delete
CREATE POLICY "Admin All Contact Messages"
ON contact_messages
FOR ALL
USING (auth.role() = 'authenticated');
