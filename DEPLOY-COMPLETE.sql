-- ===============================================
-- WARRANTY MANAGEMENT SYSTEM - COMPLETE DEPLOYMENT
-- ===============================================
-- Version: 2.2
-- Date: 2025-11-02
--
-- This file contains EVERYTHING needed to deploy
-- the complete database in ONE execution.
--
-- CHANGELOG:
-- v2.2 (2025-11-02):
--   + Added custom repair support (custom_repair_description, custom_repair_price)
--   + Updated validate_repair_cost() trigger for custom repairs
--   + Added check_repair_type_or_custom constraint
--   + Added idx_repairs_custom_repair index
-- v2.1 (2025-10-23):
--   Initial complete deployment version
--
-- ===============================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════╗';
  RAISE NOTICE '║   WARRANTY MANAGEMENT SYSTEM - DEPLOYMENT     ║';
  RAISE NOTICE '║   Version 2.2 - Complete Single File          ║';
  RAISE NOTICE '╚════════════════════════════════════════════════╝';
  RAISE NOTICE '';
END $$;

-- ===============================================
-- SECTION 1: EXTENSIONS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '📦 Installing extensions...';
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===============================================
-- SECTION 2: ENUMS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🔤 Creating ENUMs...';
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'store', 'lab');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fault_type AS ENUM ('screen', 'charging_port', 'flash', 'speaker', 'board', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE repair_status AS ENUM ('received', 'in_progress', 'completed', 'replacement_requested', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- payment_status and payment_request_status enums removed
-- Payment system simplified: all payments are direct, no statuses needed

-- ===============================================
-- SECTION 3: TABLES
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '📊 Creating tables...';
END $$;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  phone TEXT NULL,
  role user_role NOT NULL DEFAULT 'store',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notification_preferences JSONB DEFAULT '{
    "emailOnRepairAssigned": true,
    "emailOnRepairCompleted": true,
    "emailOnPaymentReceived": true,
    "emailOnWarrantyExpiring": true,
    "emailOnReplacementRequest": true
  }'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_full_name CHECK (full_name IS NULL OR length(TRIM(full_name)) >= 2),
  CONSTRAINT valid_phone CHECK (phone IS NULL OR length(phone) >= 9),
  CONSTRAINT valid_notification_preferences CHECK (notification_preferences IS NULL OR jsonb_typeof(notification_preferences) = 'object')
);

-- Device Models Table
CREATE TABLE IF NOT EXISTS device_models (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL,
  manufacturer TEXT NULL,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT device_models_pkey PRIMARY KEY (id),
  CONSTRAINT device_models_model_name_key UNIQUE (model_name),
  CONSTRAINT device_models_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT device_models_warranty_months_check CHECK (warranty_months > 0 AND warranty_months <= 36)
);

-- Devices Table
CREATE TABLE IF NOT EXISTS devices (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  imei TEXT NOT NULL,
  imei2 TEXT NULL,
  model_id UUID NOT NULL,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  is_replaced BOOLEAN NOT NULL DEFAULT false,
  replaced_at TIMESTAMPTZ NULL,
  imported_by UUID NULL,
  import_batch TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_imei_key UNIQUE (imei),
  CONSTRAINT devices_imei2_key UNIQUE (imei2),
  CONSTRAINT devices_model_id_fkey FOREIGN KEY (model_id) REFERENCES device_models (id) ON DELETE RESTRICT,
  CONSTRAINT devices_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users (id),
  CONSTRAINT devices_imei_check CHECK (imei ~ '^[0-9]{15}$'),
  CONSTRAINT devices_imei2_check CHECK (imei2 IS NULL OR imei2 ~ '^[0-9]{15}$'),
  CONSTRAINT devices_warranty_months_check CHECK (warranty_months >= 1 AND warranty_months <= 36)
);

-- Repair Types Table
CREATE TABLE IF NOT EXISTS repair_types (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT repair_types_pkey PRIMARY KEY (id),
  CONSTRAINT repair_types_name_key UNIQUE (name)
);

-- Lab Repair Prices Table
CREATE TABLE IF NOT EXISTS lab_repair_prices (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  lab_id UUID NOT NULL,
  repair_type_id UUID NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT lab_repair_prices_pkey PRIMARY KEY (id),
  CONSTRAINT lab_repair_prices_lab_id_repair_type_id_key UNIQUE (lab_id, repair_type_id),
  CONSTRAINT lab_repair_prices_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT lab_repair_prices_repair_type_id_fkey FOREIGN KEY (repair_type_id) REFERENCES repair_types (id) ON DELETE CASCADE,
  CONSTRAINT lab_repair_prices_price_check CHECK (price >= 0)
);

-- Warranties Table
CREATE TABLE IF NOT EXISTS warranties (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL,
  store_id UUID NULL,  -- Changed to NULL to allow admin-created warranties without store assignment
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  activation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_by UUID NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT warranties_pkey PRIMARY KEY (id),
  CONSTRAINT warranties_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT warranties_store_id_fkey FOREIGN KEY (store_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT warranties_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES auth.users (id),
  CONSTRAINT warranties_customer_phone_check CHECK (customer_phone ~ '^[0-9]{9,10}$'),
  CONSTRAINT warranties_customer_name_check CHECK (length(TRIM(customer_name)) >= 2),
  CONSTRAINT check_expiry_after_activation CHECK (expiry_date > activation_date)
);

-- Repairs Table
CREATE TABLE IF NOT EXISTS repairs (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL,
  lab_id UUID NOT NULL,
  warranty_id UUID NULL,
  repair_type_id UUID NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  fault_type fault_type NULL,
  fault_description TEXT NULL,
  status repair_status NOT NULL DEFAULT 'received',
  cost NUMERIC(10, 2) NULL,
  completed_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  notes TEXT NULL,
  custom_repair_description TEXT NULL,
  custom_repair_price NUMERIC(10, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT repairs_pkey PRIMARY KEY (id),
  CONSTRAINT repairs_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT repairs_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT repairs_repair_type_id_fkey FOREIGN KEY (repair_type_id) REFERENCES repair_types (id) ON DELETE RESTRICT,
  CONSTRAINT repairs_warranty_id_fkey FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE SET NULL,
  CONSTRAINT repairs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT repairs_customer_phone_check CHECK (customer_phone ~ '^[0-9]{9,10}$'),
  CONSTRAINT repairs_customer_name_check CHECK (length(TRIM(customer_name)) >= 2),
  CONSTRAINT repairs_cost_check CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT repairs_custom_repair_price_check CHECK (custom_repair_price IS NULL OR custom_repair_price >= 0),
  CONSTRAINT check_repair_type_or_custom CHECK (
    (repair_type_id IS NOT NULL AND custom_repair_description IS NULL AND custom_repair_price IS NULL) OR
    (repair_type_id IS NULL AND custom_repair_description IS NOT NULL) OR
    (repair_type_id IS NULL AND custom_repair_description IS NULL AND custom_repair_price IS NULL)
  ),
  CONSTRAINT check_completed_date CHECK ((status <> 'completed' AND completed_at IS NULL) OR (status = 'completed' AND completed_at IS NOT NULL))
);

COMMENT ON COLUMN repairs.custom_repair_description IS 'Custom repair description for one-time repairs that are not in the predefined repair_types list. When set, repair_type_id must be NULL.';
COMMENT ON COLUMN repairs.custom_repair_price IS 'Optional price for custom repairs. When custom_repair_description is set, this value is used to calculate the cost.';

-- Replacement Requests Table
CREATE TABLE IF NOT EXISTS replacement_requests (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL,
  warranty_id UUID NULL,
  repair_id UUID NULL,
  requester_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  reason TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT NULL,
  resolved_by UUID NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT replacement_requests_pkey PRIMARY KEY (id),
  CONSTRAINT replacement_requests_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT replacement_requests_warranty_id_fkey FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE SET NULL,
  CONSTRAINT replacement_requests_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES repairs (id) ON DELETE SET NULL,
  CONSTRAINT replacement_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT replacement_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT check_reason_length CHECK (length(TRIM(reason)) >= 5),
  CONSTRAINT check_resolved_fields CHECK ((status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL) OR (status != 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  lab_id UUID NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT payments_amount_check CHECK (amount > 0)
);

-- Device Search Log Table
CREATE TABLE IF NOT EXISTS device_search_log (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  search_term TEXT NOT NULL,
  device_found BOOLEAN NOT NULL,
  device_id UUID NULL,
  ip_address INET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT device_search_log_pkey PRIMARY KEY (id),
  CONSTRAINT device_search_log_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE SET NULL,
  CONSTRAINT device_search_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_opened BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT notifications_type_check CHECK (type IN (
  'replacement_request_new',
  'replacement_request_updated',
  'repair_new',
  'repair_updated',
  'payment_new',
  'user_registered',
  'repair_completed'
 ))
);
-- Payment Requests and Payment Repairs tables removed
-- Simplified payment system: Payments are direct, no request/approval needed
-- Balance = SUM(completed repairs) - SUM(payments)

-- Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);




-- ================================================================================================
-- REPAIRS TABLE INDEXES
-- ================================================================================================

-- Index for lab repairs queries (most common query pattern)
-- Used by: fetchLabRepairs(), useLabRepairs hook
-- Impact: Optimizes "SELECT * FROM repairs WHERE lab_id = ? ORDER BY created_at DESC"
CREATE INDEX IF NOT EXISTS idx_repairs_lab_created
  ON repairs(lab_id, created_at DESC)
  WHERE lab_id IS NOT NULL;

-- Index for repair status queries
-- Used by: Dashboard stats, urgent repairs, pending repairs
-- Impact: Optimizes status-based filtering
CREATE INDEX IF NOT EXISTS idx_repairs_status_created
  ON repairs(status, created_at DESC);

-- Index for completed repairs with lab_id (financial tracking)
-- Used by: useLabCompletedRepairs, useAllLabsBalances
-- Impact: Optimizes payment/financial queries
CREATE INDEX IF NOT EXISTS idx_repairs_lab_status_completed
  ON repairs(lab_id, status, completed_at DESC)
  WHERE status = 'completed';

-- Index for device lookup in repairs
-- Used by: Repair details, warranty repair history
CREATE INDEX IF NOT EXISTS idx_repairs_device_id
  ON repairs(device_id)
  WHERE device_id IS NOT NULL;

-- ================================================================================================
-- WARRANTIES TABLE INDEXES
-- ================================================================================================

-- Index for store warranties with pagination (most critical)
-- Used by: fetchStoreWarranties(), useStoreWarranties hook
-- Impact: Optimizes paginated warranty lists
CREATE INDEX IF NOT EXISTS idx_warranties_store_created
  ON warranties(store_id, created_at DESC)
  WHERE store_id IS NOT NULL;

-- Index for active warranties lookup
-- Used by: Dashboard stats, active warranty counts
-- Impact: Optimizes "is_active = true" queries
CREATE INDEX IF NOT EXISTS idx_warranties_active_expiry
  ON warranties(is_active, expiry_date DESC)
  WHERE is_active = true;

-- Index for store active warranties
-- Used by: useStoreDashboardStats
CREATE INDEX IF NOT EXISTS idx_warranties_store_active
  ON warranties(store_id, is_active, expiry_date)
  WHERE is_active = true;

-- Index for monthly activations (dashboard stats)
-- Used by: useStoreDashboardStats monthly activations
CREATE INDEX IF NOT EXISTS idx_warranties_store_activation
  ON warranties(store_id, activation_date DESC);

-- Index for device warranty lookup
-- Used by: Device details, warranty status checks
CREATE INDEX IF NOT EXISTS idx_warranties_device_id
  ON warranties(device_id)
  WHERE device_id IS NOT NULL;

-- ================================================================================================
-- DEVICES TABLE INDEXES
-- ================================================================================================

-- Index for device model lookup (included columns for covering index)
-- Used by: Device listings, repair details, warranty displays
-- Impact: Covering index reduces table lookups
CREATE INDEX IF NOT EXISTS idx_devices_model_lookup
  ON devices(model_id)
  INCLUDE (imei, imei2, created_at);

-- Index for IMEI search
-- Used by: Device search, IMEI validation
CREATE INDEX IF NOT EXISTS idx_devices_imei
  ON devices(imei);

-- Index for devices without warranty (composite)
-- Used by: useDevicesWithoutWarranty
CREATE INDEX IF NOT EXISTS idx_devices_created
  ON devices(created_at DESC);

-- ================================================================================================
-- REPLACEMENT_REQUESTS TABLE INDEXES
-- ================================================================================================

-- Index for pending replacement requests
-- Used by: Admin pending requests, dashboard stats
CREATE INDEX IF NOT EXISTS idx_replacements_status_created
  ON replacement_requests(status, created_at DESC);

-- Index for store replacement requests
-- Used by: useStoreReplacementRequests
CREATE INDEX IF NOT EXISTS idx_replacements_requester
  ON replacement_requests(requester_id, created_at DESC);

-- Index for device replacement lookup
CREATE INDEX IF NOT EXISTS idx_replacements_device
  ON replacement_requests(device_id);

-- ================================================================================================
-- LAB_REPAIR_PRICES TABLE INDEXES
-- ================================================================================================

-- Composite index for lab prices lookup (optimized query)
-- Used by: fetchLabRepairTypes() - CRITICAL for N+1 fix
-- Impact: Enables efficient JOIN in fetchLabRepairTypes
CREATE INDEX IF NOT EXISTS idx_lab_prices_lab_type_active
  ON lab_repair_prices(lab_id, repair_type_id, is_active)
  WHERE is_active = true;

-- Index for repair type prices lookup
CREATE INDEX IF NOT EXISTS idx_lab_prices_type_active
  ON lab_repair_prices(repair_type_id, is_active)
  WHERE is_active = true;

-- ================================================================================================
-- PAYMENTS TABLE INDEXES
-- ================================================================================================

-- Index for lab payments lookup
-- Used by: useLabPayments, financial tracking
CREATE INDEX IF NOT EXISTS idx_payments_lab_date
  ON payments(lab_id, payment_date DESC);

-- Index for payment date range queries
CREATE INDEX IF NOT EXISTS idx_payments_date
  ON payments(payment_date DESC);

-- ================================================================================================
-- USERS TABLE INDEXES
-- ================================================================================================

-- Index for role-based user lookup
-- Used by: useActiveLabs, user lists by role
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users(role, is_active, full_name)
  WHERE is_active = true;

-- Index for email lookup (login, auth)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- ================================================================================================
-- NOTIFICATIONS TABLE INDEXES
-- ================================================================================================

-- Index for user notifications
-- Used by: Notifications dropdown, notification counts
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- ================================================================================================
-- REPAIR_TYPES TABLE INDEXES
-- ================================================================================================

-- Index for active repair types
-- Used by: Repair type dropdowns, lab pricing
CREATE INDEX IF NOT EXISTS idx_repair_types_active_name
  ON repair_types(is_active, name)
  WHERE is_active = true;

-- ================================================================================================
-- PARTIAL INDEX ANALYSIS & STATISTICS
-- ================================================================================================

-- Analyze tables to update statistics after index creation
ANALYZE repairs;
ANALYZE warranties;
ANALYZE devices;
ANALYZE replacement_requests;
ANALYZE lab_repair_prices;
ANALYZE payments;
ANALYZE users;
ANALYZE notifications;
ANALYZE repair_types;

-- ===============================================
-- SECTION 4: HELPER FUNCTIONS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🔧 Creating helper functions...';
END $$;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid();
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  );
END;
$$;

-- Check if current user is store
CREATE OR REPLACE FUNCTION is_store()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'store'
    AND is_active = true
  );
END;
$$;

-- Check if current user is lab
CREATE OR REPLACE FUNCTION is_lab()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'lab'
    AND is_active = true
  );
END;
$$;

-- Notify all admins
-- ⚠️ SECURITY: This function is internal and should only be called by triggers.
-- EXECUTE permission is revoked from authenticated users.
CREATE OR REPLACE FUNCTION notify_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_excluded_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT id, p_type, p_title, p_message, p_data
  FROM users
  WHERE role = 'admin'
    AND is_active = true
    AND (p_excluded_user_id IS NULL OR id <> p_excluded_user_id);
END;
$$;

-- Current user role (alternative)
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Get lab device count
CREATE OR REPLACE FUNCTION get_lab_device_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  device_count INTEGER;
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  IF user_role != 'lab' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(DISTINCT r.device_id) INTO device_count
  FROM public.repairs r
  WHERE r.lab_id = auth.uid();

  RETURN device_count;
END;
$$;

-- Get user notification preference
-- ⚠️ SECURITY: Users can only access their own preferences, admins can access any
CREATE OR REPLACE FUNCTION get_user_notification_preference(
  p_user_id UUID,
  p_preference_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_preferences JSONB;
  v_value TEXT;
BEGIN
  -- Security check: users can only access their own preferences
  -- Admins can access any user's preferences
  IF p_user_id != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: you can only access your own notification preferences';
  END IF;

  -- Get user preferences
  SELECT notification_preferences INTO v_preferences
  FROM users
  WHERE id = p_user_id;

  -- If no preferences, return default (true)
  IF v_preferences IS NULL THEN
    RETURN true;
  END IF;

  -- Get specific preference value
  v_value := v_preferences->>p_preference_key;

  -- If preference not found, return default (true)
  IF v_value IS NULL THEN
    RETURN true;
  END IF;

  -- Return boolean value
  RETURN v_value::BOOLEAN;
END;
$$;

-- Auth Hook: Add user_role and user_active to JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_active boolean;
BEGIN
  -- Initialize claims from event
  claims := event->'claims';

  -- Fetch role and active status from users table
  SELECT role::text, is_active
  INTO user_role, user_active
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  -- Only add claims if user was found and values exist
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  IF user_active IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_active}', to_jsonb(user_active));
  END IF;

  -- Update the 'claims' object in the event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, just return the event unchanged
    -- This ensures the auth flow doesn't break
    RAISE WARNING 'Error in custom_access_token_hook: %', SQLERRM;
    RETURN event;
END;
$$;

-- ===============================================
-- SECTION 5: INDEXES
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '⚡ Creating indexes...';
END $$;

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Device Models Indexes
CREATE INDEX IF NOT EXISTS idx_device_models_active ON device_models(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_models_name ON device_models(model_name);

-- Devices Indexes
CREATE INDEX IF NOT EXISTS idx_devices_model ON devices(model_id);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_imei2 ON devices(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_not_replaced ON devices(is_replaced) WHERE is_replaced = false;

-- Repair Types Indexes
CREATE INDEX IF NOT EXISTS idx_repair_types_active ON repair_types(is_active) WHERE is_active = true;

-- Lab Repair Prices Indexes
CREATE INDEX IF NOT EXISTS idx_lab_repair_prices_lab ON lab_repair_prices(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_repair_prices_type ON lab_repair_prices(repair_type_id);
CREATE INDEX IF NOT EXISTS idx_lab_repair_prices_active ON lab_repair_prices(lab_id, repair_type_id) WHERE is_active = true;

-- Warranties Indexes
CREATE INDEX IF NOT EXISTS idx_warranties_device ON warranties(device_id);
CREATE INDEX IF NOT EXISTS idx_warranties_store ON warranties(store_id);
CREATE INDEX IF NOT EXISTS idx_warranties_active ON warranties(device_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_warranties_expiry ON warranties(expiry_date) WHERE is_active = true;

-- Repairs Indexes
CREATE INDEX IF NOT EXISTS idx_repairs_device ON repairs(device_id);
CREATE INDEX IF NOT EXISTS idx_repairs_lab ON repairs(lab_id);
CREATE INDEX IF NOT EXISTS idx_repairs_warranty ON repairs(warranty_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_type ON repairs(repair_type_id);
CREATE INDEX IF NOT EXISTS idx_repairs_completed ON repairs(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_custom_repair ON repairs(custom_repair_description) WHERE custom_repair_description IS NOT NULL;

-- Replacement Requests Indexes
CREATE INDEX IF NOT EXISTS idx_replacement_requests_device ON replacement_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_requester ON replacement_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_status ON replacement_requests(status);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_pending ON replacement_requests(device_id) WHERE status = 'pending';

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_lab ON payments(lab_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Device Search Log Indexes
CREATE INDEX IF NOT EXISTS idx_search_log_user_date ON device_search_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_log_date ON device_search_log(created_at DESC);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Payment Requests and Payment Repairs indexes removed (tables don't exist)

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ===============================================
-- SECTION 6: RPC (BUSINESS LOGIC) FUNCTIONS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Creating business logic functions...';
END $$;

-- Get lab dashboard stats
CREATE OR REPLACE FUNCTION get_lab_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lab_id UUID := auth.uid();
  v_stats JSON;
  v_start_of_month TIMESTAMPTZ := date_trunc('month', NOW());
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
BEGIN
  IF NOT is_lab() THEN
    RETURN '{}'::json;
  END IF;

  WITH monthly_completed_repairs AS (
    SELECT
      cost,
      fault_type,
      created_at,
      completed_at
    FROM repairs
    WHERE
      lab_id = v_lab_id
      AND status = 'completed'
      AND completed_at >= v_start_of_month
  ),
  monthly_created_repairs AS (
    SELECT 1 FROM repairs
    WHERE
      lab_id = v_lab_id
      AND created_at >= v_start_of_month
  )
  SELECT json_build_object(
    'pendingRepairs', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status = 'received'),
    'inProgressRepairs', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status = 'in_progress'),
    'completedToday', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_today_start),
    'monthlyCompleted', (SELECT COUNT(*) FROM monthly_completed_repairs),
    'monthlyRevenue', (SELECT COALESCE(SUM(cost), 0) FROM monthly_completed_repairs),
    'averageRepairTime', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600), 0) FROM monthly_completed_repairs WHERE completed_at IS NOT NULL),
    'topFaultType', (SELECT fault_type FROM monthly_completed_repairs GROUP BY fault_type ORDER BY COUNT(*) DESC LIMIT 1),
    'completionRate', (CASE WHEN (SELECT COUNT(*) FROM monthly_created_repairs) > 0 THEN ((SELECT COUNT(*) FROM monthly_completed_repairs)::float / (SELECT COUNT(*) FROM monthly_created_repairs)::float) * 100 ELSE 0 END)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Get store device count
CREATE OR REPLACE FUNCTION get_store_device_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  device_count INTEGER;
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  
  IF user_role != 'store' THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(DISTINCT w.device_id) INTO device_count
  FROM public.warranties w
  WHERE w.store_id = auth.uid();
  
  RETURN device_count;
END;
$$;

-- Activate warranty
CREATE OR REPLACE FUNCTION activate_warranty(
  p_device_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  warranty_id UUID,
  expiry_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id UUID; 
  v_warranty_months INTEGER; 
  v_expiry_date DATE; 
  v_warranty_id UUID; 
  v_is_replaced BOOLEAN;
BEGIN
  v_store_id := auth.uid();
  
  IF NOT is_store() THEN 
    RETURN QUERY SELECT false, 'רק חנויות יכולות להפעיל אחריות'::TEXT, NULL::UUID, NULL::DATE; 
    RETURN; 
  END IF;
  
  -- Check if device exists
  SELECT d.is_replaced INTO v_is_replaced
  FROM devices d
  WHERE d.id = p_device_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'מכשיר לא נמצא במערכת'::TEXT, NULL::UUID, NULL::DATE;
    RETURN;
  END IF;

  -- Get warranty months from device model
  SELECT dm.warranty_months INTO v_warranty_months
  FROM devices d
  JOIN device_models dm ON d.model_id = dm.id
  WHERE d.id = p_device_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'למכשיר אין מודל תקין במערכת. יש לפנות למנהל'::TEXT, NULL::UUID, NULL::DATE;
    RETURN;
  END IF;
  
  IF v_is_replaced THEN 
    RETURN QUERY SELECT false, 'מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות'::TEXT, NULL::UUID, NULL::DATE; 
    RETURN; 
  END IF;
  
  IF EXISTS(
    SELECT 1 FROM warranties w 
    WHERE w.device_id = p_device_id 
      AND w.is_active = true 
      AND w.expiry_date >= CURRENT_DATE
  ) THEN 
    RETURN QUERY SELECT false, 'למכשיר זה כבר קיימת אחריות פעילה'::TEXT, NULL::UUID, NULL::DATE; 
    RETURN; 
  END IF;
  
  v_expiry_date := CURRENT_DATE + (v_warranty_months || ' months')::INTERVAL;
  
  INSERT INTO warranties (device_id, store_id, customer_name, customer_phone, activation_date, expiry_date, is_active, activated_by)
  VALUES (p_device_id, v_store_id, p_customer_name, p_customer_phone, CURRENT_DATE, v_expiry_date, true, v_store_id) 
  RETURNING id INTO v_warranty_id;
  
  RETURN QUERY SELECT true, 'אחריות הופעלה בהצלחה'::TEXT, v_warranty_id, v_expiry_date;
END;
$$;

-- Approve replacement request
CREATE OR REPLACE FUNCTION approve_replacement(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device_id UUID;
  v_warranty_id UUID;
  v_current_status request_status;
BEGIN
  IF NOT is_admin() THEN 
    RETURN QUERY SELECT false, 'רק מנהל יכול לאשר בקשות החלפה'::TEXT; 
    RETURN; 
  END IF;
  
  SELECT device_id, warranty_id, status 
  INTO v_device_id, v_warranty_id, v_current_status
  FROM replacement_requests 
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN 
    RETURN QUERY SELECT false, 'בקשה לא נמצאה'::TEXT; 
    RETURN; 
  END IF;
  
  IF v_current_status != 'pending'::request_status THEN 
    RETURN QUERY SELECT false, 'בקשה כבר טופלה'::TEXT; 
    RETURN; 
  END IF;
  
  UPDATE replacement_requests 
  SET 
    status = 'approved'::request_status,
    admin_notes = p_admin_notes, 
    resolved_by = auth.uid(), 
    resolved_at = NOW() 
  WHERE id = p_request_id;
  
  UPDATE devices 
  SET 
    is_replaced = true, 
    replaced_at = NOW() 
  WHERE id = v_device_id;
  
  IF v_warranty_id IS NOT NULL THEN 
    UPDATE warranties 
    SET is_active = false 
    WHERE id = v_warranty_id; 
  END IF;
  
  RETURN QUERY SELECT true, 'בקשת ההחלפה אושרה בהצלחה'::TEXT;
END;
$$;

-- Reject replacement request
CREATE OR REPLACE FUNCTION reject_replacement(
  p_request_id UUID,
  p_admin_notes TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status request_status;
BEGIN
  IF NOT is_admin() THEN 
    RETURN QUERY SELECT false, 'רק מנהל יכול לדחות בקשות החלפה'::TEXT; 
    RETURN; 
  END IF;
  
  SELECT status 
  INTO v_current_status
  FROM replacement_requests 
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN 
    RETURN QUERY SELECT false, 'בקשה לא נמצאה'::TEXT; 
    RETURN; 
  END IF;
  
  IF v_current_status != 'pending'::request_status THEN 
    RETURN QUERY SELECT false, 'בקשה כבר טופלה'::TEXT; 
    RETURN; 
  END IF;
  
  UPDATE replacement_requests 
  SET 
    status = 'rejected'::request_status,
    admin_notes = p_admin_notes, 
    resolved_by = auth.uid(), 
    resolved_at = NOW() 
  WHERE id = p_request_id;
  
  RETURN QUERY SELECT true, 'בקשת ההחלפה נדחתה'::TEXT;
END;
$$;

-- Search device by IMEI
CREATE OR REPLACE FUNCTION search_device_by_imei(
  p_imei TEXT,
  p_user_ip TEXT DEFAULT NULL
)
RETURNS TABLE(
  device_id UUID,
  imei TEXT,
  imei2 TEXT,
  model_id UUID,
  model_name TEXT,
  manufacturer TEXT,
  warranty_months INTEGER,
  is_replaced BOOLEAN,
  replaced_at TIMESTAMPTZ,
  has_active_warranty BOOLEAN,
  warranty_id UUID,
  warranty_expiry_date DATE,
  customer_name TEXT,
  customer_phone TEXT,
  store_id UUID,
  store_name TEXT,
  searches_today INTEGER,
  search_limit_reached BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_searches_today INTEGER;
  v_device_found BOOLEAN;
  v_device_id UUID;
  v_rate_limit INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get the rate limit from the settings table
  SELECT (value->>'value')::INTEGER INTO v_rate_limit
  FROM public.settings
  WHERE key = 'imei_search_rate_limit'
  LIMIT 1;

  -- Fallback to 50 if setting is not found
  v_rate_limit := COALESCE(v_rate_limit, 50);
  
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;
  
  IF v_user_role = 'store' THEN
    SELECT COUNT(*) INTO v_searches_today
    FROM public.device_search_log
    WHERE user_id = v_user_id
      AND created_at >= CURRENT_DATE
      AND created_at < CURRENT_DATE + INTERVAL '1 day';
    
    IF v_searches_today >= v_rate_limit THEN
      RETURN QUERY
      SELECT 
        NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, 
        NULL::INTEGER, NULL::BOOLEAN, NULL::TIMESTAMPTZ, NULL::BOOLEAN,
        NULL::UUID, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT,
        v_searches_today, true;
      RETURN;
    END IF;
  ELSE
    v_searches_today := 0;
  END IF;
  
  SELECT d.id INTO v_device_id
  FROM public.devices d
  WHERE d.imei = p_imei OR d.imei2 = p_imei
  LIMIT 1;
  
  v_device_found := FOUND;
  
  INSERT INTO public.device_search_log (
    user_id, search_term, device_found, device_id, ip_address
  ) VALUES (
    v_user_id, p_imei, v_device_found, v_device_id, p_user_ip::INET
  );
  
  IF v_device_found THEN
    RETURN QUERY
    SELECT
      d.id, d.imei, d.imei2, d.model_id, dm.model_name, dm.manufacturer, dm.warranty_months,
      d.is_replaced, d.replaced_at,
      EXISTS(SELECT 1 FROM public.warranties w WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE),
      w.id, w.expiry_date,
      -- 🔒 SECURITY: Only show customer info if user is admin, the store that activated, or lab with active repair
      CASE
        WHEN is_admin() THEN w.customer_name
        WHEN is_store() AND w.store_id = auth.uid() THEN w.customer_name
        WHEN is_lab() AND EXISTS(SELECT 1 FROM public.repairs r WHERE r.device_id = d.id AND r.lab_id = auth.uid() AND r.status IN ('received', 'in_progress')) THEN w.customer_name
        ELSE NULL
      END,
      CASE
        WHEN is_admin() THEN w.customer_phone
        WHEN is_store() AND w.store_id = auth.uid() THEN w.customer_phone
        WHEN is_lab() AND EXISTS(SELECT 1 FROM public.repairs r WHERE r.device_id = d.id AND r.lab_id = auth.uid() AND r.status IN ('received', 'in_progress')) THEN w.customer_phone
        ELSE NULL
      END,
      -- Store info visible to admins only
      CASE WHEN is_admin() THEN w.store_id ELSE NULL END,
      CASE WHEN is_admin() THEN u.full_name ELSE NULL END,
      v_searches_today + 1, false
    FROM public.devices d
    LEFT JOIN public.device_models dm ON d.model_id = dm.id
    LEFT JOIN public.warranties w ON w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE
    LEFT JOIN public.users u ON w.store_id = u.id
    WHERE d.id = v_device_id;
  ELSE
    RETURN QUERY
    SELECT 
      NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, 
      NULL::INTEGER, NULL::BOOLEAN, NULL::TIMESTAMPTZ, NULL::BOOLEAN,
      NULL::UUID, NULL::DATE, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT,
      v_searches_today + 1, false;
  END IF;
END;
$$;

-- Store: Check if IMEI exists
CREATE OR REPLACE FUNCTION store_check_imei_exists(p_imei TEXT)
RETURNS TABLE(
  device_exists BOOLEAN,
  device_id UUID,
  is_mine BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role user_role;
  v_device_id UUID;
  v_is_mine BOOLEAN;
BEGIN
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;
  
  IF v_user_role != 'store' THEN
    RETURN QUERY SELECT false, NULL::UUID, false, 'אין הרשאה'::TEXT;
    RETURN;
  END IF;

  SELECT d.id INTO v_device_id
  FROM public.devices d
  WHERE d.imei = p_imei OR d.imei2 = p_imei;

  IF v_device_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, false, 'מכשיר לא נמצא במערכת'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.warranties 
    WHERE device_id = v_device_id AND store_id = v_user_id
  ) INTO v_is_mine;

  IF v_is_mine THEN
    RETURN QUERY SELECT true, v_device_id, true, 'מכשיר נמצא - שייך לחנות שלך'::TEXT;
  ELSE
    RETURN QUERY SELECT true, NULL::UUID, false, 'מכשיר קיים במערכת אך לא שייך לחנות שלך'::TEXT;
  END IF;
END;
$$;

-- Lab: Check if IMEI exists
CREATE OR REPLACE FUNCTION lab_check_imei_exists(p_imei TEXT)
RETURNS TABLE(
  device_exists BOOLEAN,
  device_id UUID,
  model_name TEXT,
  has_active_warranty BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role user_role;
  v_device_id UUID;
  v_model_name TEXT;
  v_has_warranty BOOLEAN;
BEGIN
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;
  
  IF v_user_role != 'lab' THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, 'אין הרשאה'::TEXT;
    RETURN;
  END IF;

  SELECT 
    d.id, dm.model_name,
    EXISTS(SELECT 1 FROM public.warranties w WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE)
  INTO v_device_id, v_model_name, v_has_warranty
  FROM public.devices d
  LEFT JOIN public.device_models dm ON d.model_id = dm.id
  WHERE d.imei = p_imei OR d.imei2 = p_imei;

  IF v_device_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, 'מכשיר לא נמצא'::TEXT;
    RETURN;
  END IF;

  IF EXISTS(SELECT 1 FROM public.repairs WHERE device_id = v_device_id AND status IN ('received', 'in_progress')) THEN
    RETURN QUERY SELECT true, v_device_id, v_model_name, v_has_warranty, 'כבר קיים תיקון פעיל למכשיר זה'::TEXT;
    RETURN;
  END IF;

  IF NOT v_has_warranty THEN
    RETURN QUERY SELECT true, v_device_id, v_model_name, false, 'למכשיר אין אחריות פעילה'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_device_id, v_model_name, true, 'מכשיר נמצא ותקין'::TEXT;
END;
$$;

-- Create replacement request (secure version)
CREATE OR REPLACE FUNCTION public.create_replacement_request(
    p_device_id uuid,
    p_reason text,
    p_repair_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, request_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_role text;
    v_warranty_id uuid;
    v_store_id uuid;
    v_customer_name text;
    v_customer_phone text;
    v_new_request_id uuid;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

    IF v_user_role IS NULL THEN
        RETURN QUERY SELECT false, 'User not found or inactive.'::text, NULL::uuid;
        RETURN;
    END IF;

    -- Get warranty and customer details from the latest active warranty
    SELECT id, store_id, customer_name, customer_phone
    INTO v_warranty_id, v_store_id, v_customer_name, v_customer_phone
    FROM public.warranties
    WHERE device_id = p_device_id AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no active warranty, try to get customer details from a related repair if provided
    IF v_customer_name IS NULL AND p_repair_id IS NOT NULL THEN
         SELECT customer_name, customer_phone
         INTO v_customer_name, v_customer_phone
         FROM public.repairs
         WHERE id = p_repair_id;
    END IF;

    -- Role-based authorization check
    IF v_user_role = 'store' THEN
        -- A store can only request replacement for a device they activated.
        IF v_store_id IS NULL OR v_store_id <> v_user_id THEN
            RETURN QUERY SELECT false, 'Permission denied. You can only request replacements for devices you activated.'::text, NULL::uuid;
            RETURN;
        END IF;
    ELSIF v_user_role = 'lab' THEN
        -- A lab can request replacement for any device, this is fine.
        NULL;
    ELSE
        -- Other roles (or admin) cannot create requests through this function.
        RETURN QUERY SELECT false, 'Permission denied for your role.'::text, NULL::uuid;
        RETURN;
    END IF;

    -- Insert the new replacement request
    INSERT INTO public.replacement_requests
        (device_id, warranty_id, repair_id, requester_id, reason, customer_name, customer_phone, status)
    VALUES
        (p_device_id, v_warranty_id, p_repair_id, v_user_id, p_reason, COALESCE(v_customer_name, 'N/A'), COALESCE(v_customer_phone, 'N/A'), 'pending')
    RETURNING id INTO v_new_request_id;

    -- Update repair status if repair_id is provided
    IF p_repair_id IS NOT NULL THEN
        UPDATE public.repairs SET status = 'replacement_requested' WHERE id = p_repair_id;
    END IF;

    RETURN QUERY SELECT true, 'Replacement request created successfully.'::text, v_new_request_id;

END;
$$;

-- ===============================================
-- SECTION 7: TRIGGER FUNCTIONS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🎯 Creating trigger functions...';
END $$;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Validate repair cost (supports both predefined and custom repairs)
CREATE OR REPLACE FUNCTION validate_repair_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_price NUMERIC(10,2);
BEGIN
  
  IF NEW.status = 'completed' THEN
    
    IF NEW.repair_type_id IS NOT NULL AND NEW.lab_id IS NOT NULL THEN
      SELECT price INTO v_price
      FROM public.lab_repair_prices
      WHERE lab_id = NEW.lab_id
        AND repair_type_id = NEW.repair_type_id
        AND is_active = true;

      IF FOUND THEN
        NEW.cost = v_price;
        RAISE NOTICE 'Status completed: Auto-set cost to % for predefined repair_type_id %', v_price, NEW.repair_type_id;
      ELSE
        RAISE WARNING 'Status completed: No price found for repair_type_id % at lab_id %', NEW.repair_type_id, NEW.lab_id;
        NEW.cost = NULL;
      END IF;
    
    ELSIF NEW.custom_repair_description IS NOT NULL THEN
      NEW.cost = NEW.custom_repair_price; 
      RAISE NOTICE 'Status completed: Set cost to custom price % for custom repair "%"', NEW.custom_repair_price, NEW.custom_repair_description;
    
    ELSE

      NEW.cost = NULL;
      RAISE WARNING 'Status completed: No repair_type_id or custom_description set. Cost set to NULL.';
    END IF;

  ELSE
    NEW.cost = NULL;
    RAISE NOTICE 'Status not completed (%): Cost set to NULL.', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

  -- Handle CUSTOM REPAIRS
  -- If custom repair is specified, use custom_repair_price as cost
  IF NEW.custom_repair_description IS NOT NULL THEN
    IF NEW.custom_repair_price IS NOT NULL THEN
      NEW.cost = NEW.custom_repair_price;
      RAISE NOTICE 'Set cost to custom price % for custom repair "%"', NEW.custom_repair_price, NEW.custom_repair_description;
    ELSE
      -- Custom repair without price - keep cost as NULL
      NEW.cost = NULL;
      RAISE NOTICE 'Custom repair "%s" created without price', NEW.custom_repair_description;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Populate replacement customer details
CREATE OR REPLACE FUNCTION populate_replacement_customer_details()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_name TEXT;
  v_customer_phone TEXT;
BEGIN
  IF NEW.customer_name IS NULL OR NEW.customer_phone IS NULL THEN
    IF NEW.repair_id IS NOT NULL THEN
      SELECT customer_name, customer_phone INTO v_customer_name, v_customer_phone
      FROM public.repairs WHERE id = NEW.repair_id;
      
      IF FOUND THEN
        NEW.customer_name = COALESCE(NEW.customer_name, v_customer_name);
        NEW.customer_phone = COALESCE(NEW.customer_phone, v_customer_phone);
        RETURN NEW;
      END IF;
    END IF;
    
    IF NEW.warranty_id IS NOT NULL THEN
      SELECT customer_name, customer_phone INTO v_customer_name, v_customer_phone
      FROM public.warranties WHERE id = NEW.warranty_id;
      
      IF FOUND THEN
        NEW.customer_name = COALESCE(NEW.customer_name, v_customer_name);
        NEW.customer_phone = COALESCE(NEW.customer_phone, v_customer_phone);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Prevent warranty date change
CREATE OR REPLACE FUNCTION prevent_warranty_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.activation_date IS DISTINCT FROM NEW.activation_date THEN
    RAISE EXCEPTION 'Cannot change warranty activation date after creation';
  END IF;
  
  IF OLD.expiry_date IS DISTINCT FROM NEW.expiry_date THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Only admin can change warranty expiry date';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Prevent unreplace device
CREATE OR REPLACE FUNCTION prevent_unreplace_device()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_replaced = true AND NEW.is_replaced = false THEN
    RAISE EXCEPTION 'Cannot unreplace a device that has been marked as replaced';
  END IF;
  RETURN NEW;
END;
$$;

-- Handle new user (for auth.users trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert bypassing RLS by using SECURITY DEFINER context
  INSERT INTO public.users (id, email, full_name, phone, role, is_active, created_by)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'store'),
    true,
    NULL
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth creation
    RAISE WARNING 'Failed to create user in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Notify on new repair OR completed repair
CREATE OR REPLACE FUNCTION handle_repair_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device_imei TEXT;
  v_lab_name TEXT;
  v_repair_type_name TEXT;
  v_model_name TEXT;
BEGIN
  SELECT d.imei, dm.model_name
  INTO v_device_imei, v_model_name
  FROM devices d
  LEFT JOIN device_models dm ON d.model_id = dm.id
  WHERE d.id = NEW.device_id;
  
  SELECT full_name INTO v_lab_name
  FROM users
  WHERE id = NEW.lab_id;

  IF (TG_OP = 'INSERT') THEN
    PERFORM notify_admins(
      'repair_new',
      'תיקון חדש נוצר',
      'תיקון חדש נוצר (' || COALESCE(v_model_name, 'דגם לא ידוע') || ') על ידי ' || COALESCE(v_lab_name, 'מעבדה') || ' למכשיר ' || v_device_imei,
      jsonb_build_object(
        'device_imei', v_device_imei,
        'model_name', COALESCE(v_model_name, 'לא ידוע'),
        'lab_name', COALESCE(v_lab_name, 'מעבדה'),
        'fault_type', NEW.fault_type
      )
    );

  ELSIF (TG_OP = 'UPDATE') THEN

    IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
    
      IF NEW.repair_type_id IS NOT NULL THEN
        SELECT name INTO v_repair_type_name FROM repair_types WHERE id = NEW.repair_type_id;
      ELSE
        v_repair_type_name := NEW.custom_repair_description;
      END IF;

      PERFORM notify_admins(
        'repair_completed',
        'תיקון הושלם',
        'התיקון למכשיר ' || COALESCE(v_model_name, v_device_imei) || ' (עלות: ' || COALESCE(NEW.cost::text, 'לא נקבע') || ' ש"ח) הושלם.',
        jsonb_build_object(
          'device_imei', v_device_imei,
          'model_name', COALESCE(v_model_name, 'לא ידוע'),
          'lab_name', COALESCE(v_lab_name, 'מעבדה'),
          'repair_type', COALESCE(v_repair_type_name, 'לא צוין'),
          'cost', NEW.cost
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Notify on new payment
CREATE OR REPLACE FUNCTION notify_on_new_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lab_name TEXT;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();

  SELECT full_name INTO v_lab_name
  FROM users
  WHERE id = NEW.lab_id;

  PERFORM notify_admins(
    'payment_new',
    'תשלום חדש התקבל',
    'תשלום בסך ' || NEW.amount || ' ₪ התקבל מ-' || COALESCE(v_lab_name, 'מעבדה'),
    jsonb_build_object(
      'payment_id', NEW.id,
      'lab_id', NEW.lab_id,
      'lab_name', v_lab_name,
      'amount', NEW.amount,
      'payment_date', NEW.payment_date
    ),
    v_actor_id
  );

  RETURN NEW;
END;
$$;

-- Payment request functions removed - simplified payment system

-- Notify on replacement request
CREATE OR REPLACE FUNCTION notify_on_replacement_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device_imei TEXT;
  v_requester_name TEXT;
BEGIN
  SELECT imei INTO v_device_imei
  FROM devices
  WHERE id = NEW.device_id;
  
  SELECT full_name INTO v_requester_name
  FROM users
  WHERE id = NEW.requester_id;
  
  PERFORM notify_admins(
    'replacement_request_new',
    'בקשת החלפה חדשה',
    'בקשת החלפה חדשה מ-' || COALESCE(v_requester_name, 'משתמש') || ' למכשיר ' || v_device_imei,
    jsonb_build_object(
      'request_id', NEW.id,
      'device_id', NEW.device_id,
      'device_imei', v_device_imei,
      'requester_id', NEW.requester_id,
      'requester_name', v_requester_name
    )
  );
  
  RETURN NEW;
END;
$$;

-- Notify on replacement status change
CREATE OR REPLACE FUNCTION notify_on_replacement_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device_imei TEXT;
  v_status_text TEXT;
BEGIN
  IF OLD.status = 'pending'::request_status AND NEW.status != 'pending'::request_status THEN
    SELECT imei INTO v_device_imei
    FROM devices
    WHERE id = NEW.device_id;
    
    v_status_text := CASE NEW.status::TEXT
      WHEN 'approved' THEN 'אושרה'
      WHEN 'rejected' THEN 'נדחתה'
      ELSE NEW.status::TEXT
    END;
    
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.requester_id,
      'replacement_request_updated',
      'עדכון בקשת החלפה',
      'בקשת ההחלפה למכשיר ' || v_device_imei || ' ' || v_status_text,
      jsonb_build_object(
        'request_id', NEW.id,
        'device_id', NEW.device_id,
        'device_imei', v_device_imei,
        'status', NEW.status::TEXT,
        'admin_notes', NEW.admin_notes
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- TRIGGER FUNCTION: handle_user_profile_update
--
DO $$
BEGIN
  RAISE NOTICE '   -> Creating trigger function handle_user_profile_update()';
END $$;

CREATE OR REPLACE FUNCTION public.handle_user_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT auth.role() INTO user_role;

  IF user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF user_role = 'store' OR user_role = 'lab' THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name OR NEW.phone IS DISTINCT FROM OLD.phone THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Only admins can update full_name or phone.';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Audit replacement request creation
CREATE OR REPLACE FUNCTION public.audit_replacement_request_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, meta)
    VALUES (NEW.requester_id, 'replacement.create', 'replacement_request', NEW.id, jsonb_build_object(
        'device_id', NEW.device_id,
        'reason', NEW.reason,
        'requester_id', NEW.requester_id
    ));
    RETURN NEW;
END;
$$;

-- ===============================================
-- SECTION 8: TRIGGERS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '⚙️  Creating triggers...';
END $$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_device_models_updated_at ON device_models;
CREATE TRIGGER update_device_models_updated_at BEFORE UPDATE ON device_models FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_repair_types_updated_at ON repair_types;
CREATE TRIGGER update_repair_types_updated_at BEFORE UPDATE ON repair_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_lab_repair_prices_updated_at ON lab_repair_prices;
CREATE TRIGGER update_lab_repair_prices_updated_at BEFORE UPDATE ON lab_repair_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_warranties_updated_at ON warranties;
CREATE TRIGGER update_warranties_updated_at BEFORE UPDATE ON warranties FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_repairs_updated_at ON repairs;
CREATE TRIGGER update_repairs_updated_at BEFORE UPDATE ON repairs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_replacement_requests_updated_at ON replacement_requests;
CREATE TRIGGER update_replacement_requests_updated_at BEFORE UPDATE ON replacement_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Payment request triggers removed - simplified payment system

-- Business logic triggers
DROP TRIGGER IF EXISTS enforce_repair_cost_trigger ON repairs;
CREATE TRIGGER enforce_repair_cost_trigger
  BEFORE INSERT OR UPDATE OF repair_type_id, lab_id, status ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION validate_repair_cost();

DROP TRIGGER IF EXISTS populate_replacement_customer_details_trigger ON replacement_requests;
CREATE TRIGGER populate_replacement_customer_details_trigger
  BEFORE INSERT ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION populate_replacement_customer_details();

DROP TRIGGER IF EXISTS prevent_warranty_date_change_trigger ON warranties;
CREATE TRIGGER prevent_warranty_date_change_trigger
  BEFORE UPDATE ON warranties
  FOR EACH ROW
  EXECUTE FUNCTION prevent_warranty_date_change();

DROP TRIGGER IF EXISTS prevent_unreplace_device_trigger ON devices;
CREATE TRIGGER prevent_unreplace_device_trigger
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unreplace_device();

-- Notification triggers
DROP TRIGGER IF EXISTS trigger_notify_new_repair ON repairs;

DROP TRIGGER IF EXISTS on_new_repair ON repairs;
CREATE TRIGGER on_new_repair
 AFTER INSERT ON repairs
 FOR EACH ROW
 EXECUTE FUNCTION handle_repair_notifications();

DROP TRIGGER IF EXISTS on_update_repair ON repairs;
CREATE TRIGGER on_update_repair
 AFTER UPDATE ON repairs
 FOR EACH ROW
 EXECUTE FUNCTION handle_repair_notifications();

DROP TRIGGER IF EXISTS trigger_notify_new_payment ON payments;
CREATE TRIGGER trigger_notify_new_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_payment();

-- Payment request notification triggers removed - simplified payment system

DROP TRIGGER IF EXISTS trigger_notify_replacement_request ON replacement_requests;
CREATE TRIGGER trigger_notify_replacement_request
  AFTER INSERT ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_replacement_request();

DROP TRIGGER IF EXISTS trigger_notify_replacement_status ON replacement_requests;
CREATE TRIGGER trigger_notify_replacement_status
  AFTER UPDATE ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_replacement_status_change();

DROP TRIGGER IF EXISTS on_replacement_request_created ON public.replacement_requests;
CREATE TRIGGER on_replacement_request_created
  AFTER INSERT ON public.replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_replacement_request_creation();

DROP TRIGGER IF EXISTS on_user_profile_update ON public.users;
CREATE TRIGGER on_user_profile_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_profile_update();



-- ===============================================
-- SECTION 9: VIEWS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '👁️  Creating views...';
END $$;

-- IMEI Lookup View
CREATE OR REPLACE VIEW devices_imei_lookup AS
SELECT
  d.id, d.imei, d.imei2, d.is_replaced, dm.model_name,
  EXISTS(SELECT 1 FROM warranties w WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE) AS has_active_warranty,
  EXISTS(SELECT 1 FROM repairs r WHERE r.device_id = d.id AND r.status IN ('received', 'in_progress')) AS has_active_repair
FROM devices d
LEFT JOIN device_models dm ON d.model_id = dm.id;

-- Devices with Status View
CREATE OR REPLACE VIEW devices_with_status AS
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

-- Active Warranties with Replacements View
-- 🔒 SECURITY: Explicitly list columns instead of w.* to control data exposure
-- RLS policies still apply, so users only see rows they're authorized to see
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
LEFT JOIN users u ON w.store_id = u.id  -- Changed from JOIN to LEFT JOIN to support NULL store_id
WHERE w.is_active = true;

-- Admin Dashboard Stats View
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM devices WHERE NOT is_replaced) AS total_devices,
  (SELECT COUNT(*) FROM warranties WHERE is_active = true AND expiry_date >= CURRENT_DATE) AS active_warranties,
  (SELECT COUNT(*) FROM repairs WHERE status IN ('received', 'in_progress')) AS pending_repairs,
  (SELECT COUNT(*) FROM replacement_requests WHERE status = 'pending') AS pending_replacements,
  (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'store') AS total_stores,
  (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'lab') AS total_labs;

-- ===============================================
-- SECTION 10: RLS ENABLE
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🔒 Enabling RLS...';
END $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_repair_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE replacement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- payment_requests and payment_repairs tables removed - simplified payment system
ALTER TABLE device_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- SECTION 10.5: DEFAULT DATA
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '💾 Inserting default data...';
END $$;

INSERT INTO public.settings (key, value)
VALUES
    ('imei_search_rate_limit', '{"value": 50}')
ON CONFLICT (key) DO NOTHING;


-- ===============================================
-- SECTION 11: RLS POLICIES
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🛡️  Creating RLS policies...';
END $$;

-- Drop existing policies
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Users Table Policies
CREATE POLICY "Admins can do everything" ON users FOR ALL TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Users can read their own data" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can create their own profile" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND role = (SELECT u.role FROM users u WHERE u.id = auth.uid()));
-- Allow service_role to insert users (for auth trigger)
CREATE POLICY "Service role can insert users" ON users FOR INSERT TO service_role WITH CHECK (true);

-- Device Models Policies
CREATE POLICY "admin_all" ON device_models FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "public_select" ON device_models FOR SELECT TO authenticated USING (is_active = true);

-- Devices Policies
CREATE POLICY "admin_all" ON devices FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
-- ℹ️ NOTE: All authenticated users can view devices (IMEI lookup needed for warranty activation & repairs)
-- This is acceptable as devices table contains no customer PII - only technical device info (IMEI, model, etc)
-- Customer data is protected in warranties/repairs tables via their own RLS policies
CREATE POLICY "authenticated_select" ON devices FOR SELECT TO authenticated USING (true);

-- Repair Types Policies
CREATE POLICY "admin_all" ON repair_types FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "public_select" ON repair_types FOR SELECT TO authenticated USING (is_active = true);

-- Lab Repair Prices Policies
CREATE POLICY "admin_all" ON lab_repair_prices FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "lab_select" ON lab_repair_prices FOR SELECT TO authenticated USING (is_lab() AND lab_id = auth.uid());

-- Warranties Policies
CREATE POLICY "admin_all" ON warranties FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "store_select" ON warranties FOR SELECT TO authenticated USING (is_store() AND store_id = auth.uid());
CREATE POLICY "lab_select"
ON "public"."warranties"
FOR SELECT
TO authenticated
USING (is_lab());

-- Repairs Policies
CREATE POLICY "admin_all" ON repairs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "lab_select" ON repairs FOR SELECT TO authenticated USING (is_lab() AND lab_id = auth.uid());
CREATE POLICY "lab_insert" ON repairs FOR INSERT TO authenticated WITH CHECK (is_lab() AND lab_id = auth.uid());
CREATE POLICY "lab_update" ON repairs FOR UPDATE TO authenticated USING (is_lab() AND lab_id = auth.uid()) WITH CHECK (is_lab() AND lab_id = auth.uid());

-- Replacement Requests Policies
CREATE POLICY "Admin can view all requests" ON replacement_requests FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can update all requests" ON replacement_requests FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete requests" ON replacement_requests FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Authenticated users can create requests" ON replacement_requests FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Users can view own requests" ON replacement_requests FOR SELECT TO authenticated USING (requester_id = auth.uid());
CREATE POLICY "Users can update own pending requests" ON replacement_requests FOR UPDATE TO authenticated USING (requester_id = auth.uid() AND status = 'pending');

-- Payments Policies
CREATE POLICY "admin_all" ON payments FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "labs_view_own" ON payments FOR SELECT TO authenticated USING (is_lab() AND lab_id = auth.uid());

-- Payment request policies removed - simplified payment system

-- Device Search Log Policies
CREATE POLICY "admin_all" ON device_search_log FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "users_view_own" ON device_search_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users_insert_own" ON device_search_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Settings Policies
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Authenticated users can read settings" ON public.settings FOR SELECT USING (auth.role() = 'authenticated');

-- ===============================================
-- SECTION 12: PERMISSIONS
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '🔑 Granting permissions...';
END $$;

-- ⚠️ SECURITY: Only service_role gets full access
-- All user access is controlled via RLS policies
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Explicitly grant INSERT on users table for auth trigger
GRANT INSERT ON public.users TO postgres;

-- Authenticated users get sequence access only (for inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Authenticated users can execute RPC functions (SECURITY DEFINER protects them)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant execute permission to supabase_auth_admin for the auth hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;


-- Revoke execute on internal/system functions that should only be called by triggers
REVOKE EXECUTE ON FUNCTION notify_admins(TEXT, TEXT, TEXT, JSONB, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION validate_repair_cost() FROM authenticated;
REVOKE EXECUTE ON FUNCTION populate_replacement_customer_details() FROM authenticated;
REVOKE EXECUTE ON FUNCTION prevent_warranty_date_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION prevent_unreplace_device() FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_repair_notifications() FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_new_payment() FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_replacement_request() FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_replacement_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION audit_replacement_request_creation() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Views: Read-only access for authenticated users
GRANT SELECT ON devices_imei_lookup TO authenticated;
GRANT SELECT ON devices_with_status TO authenticated;
GRANT SELECT ON active_warranties_with_replacements TO authenticated;
GRANT SELECT ON admin_dashboard_stats TO authenticated;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role, authenticated;

-- ===============================================
-- SECTION 13: AUDIT LOG (Added)
-- ===============================================

DO $$
BEGIN
  RAISE NOTICE '📝 Creating audit log table...';
END $$;

-- Create the audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users (id) ON DELETE CASCADE
);

-- Create indexes for the audit_log table
DO $$
BEGIN
  RAISE NOTICE '⚡ Creating audit log indexes...';
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Enable RLS for the audit_log table
DO $$
BEGIN
  RAISE NOTICE '🔒 Enabling RLS for audit log...';
END $$;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the audit_log table
DO $$
BEGIN
  RAISE NOTICE '🛡️  Creating RLS policies for audit log...';
END $$;
DROP POLICY IF EXISTS "admin_all_access" ON public.audit_log;
CREATE POLICY "admin_all_access" ON public.audit_log FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "service_role_insert" ON public.audit_log;
CREATE POLICY "service_role_insert" ON public.audit_log FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_log;
CREATE POLICY "Users can insert their own audit logs" ON public.audit_log FOR INSERT WITH CHECK (actor_user_id = auth.uid());


-- ===============================================
-- COMPLETION
-- ===============================================

COMMIT;

DO $$
DECLARE
  table_count INTEGER;
  view_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT COUNT(*) INTO view_count FROM information_schema.views WHERE table_schema = 'public';
  SELECT COUNT(*) INTO function_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prokind = 'f';
  SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE trigger_schema = 'public';
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════╗';
  RAISE NOTICE '║     DEPLOYMENT COMPLETED SUCCESSFULLY! ✅     ║';
  RAISE NOTICE '╚════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Database Summary:';
  RAISE NOTICE '   • Tables:    %', table_count;
  RAISE NOTICE '   • Views:     %', view_count;
  RAISE NOTICE '   • Functions: %', function_count;
  RAISE NOTICE '   • Triggers:  %', trigger_count;
  RAISE NOTICE '   • Policies:  %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Your warranty management system is ready!';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '   1. Check your user role: SELECT role FROM users WHERE id = auth.uid();';
  RAISE NOTICE '   2. If not admin, update: UPDATE users SET role = ''admin'' WHERE email = ''your@email.com'';';
  RAISE NOTICE '   3. Test access: SELECT COUNT(*) FROM devices;';
  RAISE NOTICE '   4. Import your data if needed';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Tip: Always backup before making changes!';
  RAISE NOTICE '';
END $$;