ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS document_hash text,
  ADD COLUMN IF NOT EXISTS signature_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_doc_masked text;