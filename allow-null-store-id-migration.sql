-- Migration: Allow NULL store_id in warranties table
-- This allows admins to create warranties not associated with any specific store

-- Step 1: Remove NOT NULL constraint from store_id
ALTER TABLE warranties ALTER COLUMN store_id DROP NOT NULL;

-- Step 2: Update RLS policies to handle NULL store_id

-- Drop existing store policies
DROP POLICY IF EXISTS "store_select" ON warranties;
DROP POLICY IF EXISTS "store_insert" ON warranties;

-- Recreate store_select policy to only show warranties WHERE store_id matches (excludes NULL)
CREATE POLICY "store_select" ON warranties
FOR SELECT TO authenticated
USING (
  is_store() AND store_id = auth.uid()
);

-- Recreate store_insert policy to only allow inserting with their own store_id
CREATE POLICY "store_insert" ON warranties
FOR INSERT TO authenticated
WITH CHECK (
  is_store() AND store_id = auth.uid()
);

-- Note: Admin policy "admin_all" already allows admins to do everything, including NULL store_id

-- Step 3: Verify foreign key constraint allows NULL
-- The FK constraint "warranties_store_id_fkey" should already allow NULL values by default
-- Foreign key constraints in PostgreSQL allow NULL unless explicitly prevented

-- Step 4: Update active_warranties_with_replacements view to support NULL store_id
CREATE OR REPLACE VIEW active_warranties_with_replacements AS
SELECT
  w.id, w.device_id, w.store_id, w.activation_date, w.expiry_date, w.is_active,
  w.customer_name, w.customer_phone, w.notes, w.created_at, w.updated_at,
  d.imei, d.is_replaced, dm.model_name, u.full_name AS store_name,
  CASE
    WHEN w.expiry_date > NOW() AND w.is_active THEN 'active'
    WHEN w.expiry_date <= NOW() THEN 'expired'
    ELSE 'cancelled'
  END AS warranty_status,
  (SELECT COUNT(*) FROM replacement_requests rr WHERE rr.device_id = w.device_id AND rr.status = 'pending') AS pending_replacements,
  (SELECT COUNT(*) FROM replacement_requests rr WHERE rr.device_id = w.device_id AND rr.status = 'approved') AS approved_replacements
FROM warranties w
JOIN devices d ON w.device_id = d.id
LEFT JOIN device_models dm ON d.model_id = dm.id
LEFT JOIN users u ON w.store_id = u.id;  -- Changed from JOIN to LEFT JOIN to support NULL store_id

COMMENT ON COLUMN warranties.store_id IS 'חנות שהפעילה את האחריות. NULL = הופעל ע"י מנהל ללא שיוך לחנות';
