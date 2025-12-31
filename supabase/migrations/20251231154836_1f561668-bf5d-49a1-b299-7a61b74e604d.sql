-- Adicionar coluna para controlar registro de robots
ALTER TABLE bitrix_installations 
ADD COLUMN IF NOT EXISTS robots_registered BOOLEAN DEFAULT FALSE;