-- Migration: Add warranty_months to devices table
-- Date: 2025-11-16
-- Purpose: Allow per-device warranty duration instead of only per-model

-- Add warranty_months column to devices table
ALTER TABLE devices
ADD COLUMN warranty_months INTEGER;

-- Set default value from device_models for existing devices
UPDATE devices d
SET warranty_months = dm.warranty_months
FROM device_models dm
WHERE d.model_id = dm.id
  AND d.warranty_months IS NULL;

-- Make warranty_months NOT NULL with default 12
ALTER TABLE devices
ALTER COLUMN warranty_months SET NOT NULL,
ALTER COLUMN warranty_months SET DEFAULT 12;

-- Add check constraint: warranty_months between 1 and 36
ALTER TABLE devices
ADD CONSTRAINT devices_warranty_months_check CHECK (warranty_months >= 1 AND warranty_months <= 36);

-- Update the devices_with_status view to use devices.warranty_months
-- Drop the view first to avoid column name conflicts
DROP VIEW IF EXISTS devices_with_status;

CREATE VIEW devices_with_status AS
SELECT
  d.id,
  d.imei,
  d.imei2,
  d.model_id,
  d.warranty_months,
  d.is_replaced,
  d.replaced_at,
  d.imported_by,
  d.import_batch,
  d.notes,
  d.created_at,
  d.updated_at,
  dm.model_name,
  CASE
    WHEN d.is_replaced THEN 'replaced'
    WHEN EXISTS(SELECT 1 FROM warranties w WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE) THEN 'active'
    WHEN EXISTS(SELECT 1 FROM warranties w WHERE w.device_id = d.id) THEN 'expired'
    ELSE 'new'
  END AS warranty_status
FROM devices d
LEFT JOIN device_models dm ON d.model_id = dm.id;

-- Add comment to explain the change
COMMENT ON COLUMN devices.warranty_months IS 'משך האחריות במספר חודשים - ספציפי למכשיר זה (לא תלוי בדגם)';
