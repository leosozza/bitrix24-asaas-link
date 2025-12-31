-- Step 1: Deduplicate bitrix_installations keeping the most recent per member_id
-- First, update bitrix_pay_systems to point to the canonical (most recent) installation
WITH canonical_installations AS (
  SELECT DISTINCT ON (member_id) id, member_id
  FROM bitrix_installations
  WHERE member_id IS NOT NULL
  ORDER BY member_id, updated_at DESC, created_at DESC
),
duplicates AS (
  SELECT bi.id AS dup_id, ci.id AS canonical_id
  FROM bitrix_installations bi
  JOIN canonical_installations ci ON bi.member_id = ci.member_id
  WHERE bi.id != ci.id
)
UPDATE bitrix_pay_systems bps
SET installation_id = d.canonical_id
FROM duplicates d
WHERE bps.installation_id = d.dup_id;

-- Step 2: Delete duplicate installations (keep only the canonical one per member_id)
DELETE FROM bitrix_installations
WHERE id IN (
  SELECT bi.id
  FROM bitrix_installations bi
  WHERE bi.member_id IS NOT NULL
    AND bi.id NOT IN (
      SELECT DISTINCT ON (member_id) id
      FROM bitrix_installations
      WHERE member_id IS NOT NULL
      ORDER BY member_id, updated_at DESC, created_at DESC
    )
);

-- Step 3: Create unique index on member_id to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_bitrix_installations_member_id_unique 
ON bitrix_installations (member_id) 
WHERE member_id IS NOT NULL;