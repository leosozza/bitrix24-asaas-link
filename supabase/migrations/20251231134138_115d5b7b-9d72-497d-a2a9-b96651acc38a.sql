-- Remove partial unique indexes that don't work with ON CONFLICT
DROP INDEX IF EXISTS bitrix_installations_member_id_unique;
DROP INDEX IF EXISTS idx_bitrix_installations_member_id_unique;

-- Add a real UNIQUE constraint on member_id (works with ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bitrix_installations_member_id_key'
  ) THEN
    ALTER TABLE bitrix_installations 
    ADD CONSTRAINT bitrix_installations_member_id_key UNIQUE (member_id);
  END IF;
END $$;