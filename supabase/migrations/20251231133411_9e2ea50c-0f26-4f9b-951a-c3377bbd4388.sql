-- Add unique constraint on member_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'bitrix_installations_member_id_unique'
  ) THEN
    CREATE UNIQUE INDEX bitrix_installations_member_id_unique 
    ON public.bitrix_installations (member_id) 
    WHERE member_id IS NOT NULL;
  END IF;
END $$;