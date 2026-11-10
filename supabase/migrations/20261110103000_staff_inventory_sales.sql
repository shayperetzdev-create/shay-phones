-- Roles, warranty functions, inventory, sales, and the IMEI link to warranty activation.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_store()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'store' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lab()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'lab' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'ops', 'marketing')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role := 'store';
BEGIN
  BEGIN
    IF NEW.raw_app_meta_data ? 'role' THEN
      v_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'store';
  END;

  INSERT INTO public.users (id, email, full_name, phone, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    v_role,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','device_models','devices','repair_types','lab_repair_prices',
    'warranties','repairs','replacement_requests','payments','settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      t, t
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role_active ON public.users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_devices_imei ON public.devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_imei2 ON public.devices(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warranties_device ON public.warranties(device_id);
CREATE INDEX IF NOT EXISTS idx_repairs_lab ON public.repairs(lab_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON public.repairs(status);

INSERT INTO public.settings (key, value)
VALUES ('imei_search_rate_limit', '{"value": 50}')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_store_device_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_count integer;
BEGIN
  IF NOT public.is_store() THEN
    RETURN 0;
  END IF;
  SELECT COUNT(DISTINCT w.device_id) INTO device_count
  FROM public.warranties w
  WHERE w.store_id = auth.uid();
  RETURN device_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_lab_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab_id uuid := auth.uid();
  v_stats json;
  v_start_of_month timestamptz := date_trunc('month', now());
  v_today_start timestamptz := date_trunc('day', now());
BEGIN
  IF NOT public.is_lab() THEN
    RETURN '{}'::json;
  END IF;

  SELECT json_build_object(
    'pendingRepairs', (SELECT COUNT(*) FROM public.repairs WHERE lab_id = v_lab_id AND status = 'received'),
    'inProgressRepairs', (SELECT COUNT(*) FROM public.repairs WHERE lab_id = v_lab_id AND status = 'in_progress'),
    'completedToday', (SELECT COUNT(*) FROM public.repairs WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_today_start),
    'monthlyCompleted', (SELECT COUNT(*) FROM public.repairs WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_start_of_month),
    'monthlyRevenue', (SELECT COALESCE(SUM(cost), 0) FROM public.repairs WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_start_of_month),
    'averageRepairTime', 0,
    'topFaultType', NULL,
    'completionRate', 0
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_warranty(
  p_device_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, warranty_id uuid, expiry_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid := auth.uid();
  v_warranty_months integer;
  v_expiry_date date;
  v_warranty_id uuid;
  v_is_replaced boolean;
  v_assigned_store uuid;
BEGIN
  IF NOT public.is_store() THEN
    RETURN QUERY SELECT false, 'רק חנויות יכולות להפעיל אחריות'::text, NULL::uuid, NULL::date;
    RETURN;
  END IF;

  SELECT d.is_replaced, dist.store_user_id
  INTO v_is_replaced, v_assigned_store
  FROM public.devices d
  LEFT JOIN public.distributors dist ON dist.id = d.distributor_id
  WHERE d.id = p_device_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'מכשיר לא נמצא במערכת'::text, NULL::uuid, NULL::date;
    RETURN;
  END IF;

  IF v_assigned_store IS NOT NULL AND v_assigned_store <> v_store_id THEN
    RETURN QUERY SELECT false, 'המכשיר שויך לחנות אחרת במכירה'::text, NULL::uuid, NULL::date;
    RETURN;
  END IF;

  SELECT dm.warranty_months INTO v_warranty_months
  FROM public.devices d
  JOIN public.device_models dm ON d.model_id = dm.id
  WHERE d.id = p_device_id;

  IF v_is_replaced THEN
    RETURN QUERY SELECT false, 'מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות'::text, NULL::uuid, NULL::date;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.warranties w
    WHERE w.device_id = p_device_id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE
  ) THEN
    RETURN QUERY SELECT false, 'למכשיר זה כבר קיימת אחריות פעילה'::text, NULL::uuid, NULL::date;
    RETURN;
  END IF;

  v_expiry_date := CURRENT_DATE + (v_warranty_months || ' months')::interval;

  INSERT INTO public.warranties (
    device_id, store_id, customer_name, customer_phone, activation_date, expiry_date, is_active, activated_by, notes
  ) VALUES (
    p_device_id, v_store_id, p_customer_name, p_customer_phone, CURRENT_DATE, v_expiry_date, true, v_store_id, p_notes
  )
  RETURNING id INTO v_warranty_id;

  RETURN QUERY SELECT true, 'אחריות הופעלה בהצלחה'::text, v_warranty_id, v_expiry_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_replacement(p_request_id uuid, p_admin_notes text DEFAULT NULL)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id uuid;
  v_warranty_id uuid;
  v_current_status public.request_status;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT false, 'רק מנהל יכול לאשר בקשות החלפה'::text;
    RETURN;
  END IF;

  SELECT device_id, warranty_id, status
  INTO v_device_id, v_warranty_id, v_current_status
  FROM public.replacement_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'בקשה לא נמצאה'::text;
    RETURN;
  END IF;

  IF v_current_status <> 'pending'::public.request_status THEN
    RETURN QUERY SELECT false, 'בקשה כבר טופלה'::text;
    RETURN;
  END IF;

  UPDATE public.replacement_requests
  SET status = 'approved', admin_notes = p_admin_notes, resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_request_id;

  UPDATE public.devices
  SET is_replaced = true, replaced_at = now(), inventory_status = 'written_off'
  WHERE id = v_device_id;

  IF v_warranty_id IS NOT NULL THEN
    UPDATE public.warranties SET is_active = false WHERE id = v_warranty_id;
  END IF;

  RETURN QUERY SELECT true, 'בקשת ההחלפה אושרה בהצלחה'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_replacement(p_request_id uuid, p_admin_notes text)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status public.request_status;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN QUERY SELECT false, 'רק מנהל יכול לדחות בקשות החלפה'::text;
    RETURN;
  END IF;

  SELECT status INTO v_current_status FROM public.replacement_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'בקשה לא נמצאה'::text;
    RETURN;
  END IF;
  IF v_current_status <> 'pending'::public.request_status THEN
    RETURN QUERY SELECT false, 'בקשה כבר טופלה'::text;
    RETURN;
  END IF;

  UPDATE public.replacement_requests
  SET status = 'rejected', admin_notes = p_admin_notes, resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_request_id;

  RETURN QUERY SELECT true, 'בקשת ההחלפה נדחתה'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_device_by_imei(p_imei text, p_user_ip text DEFAULT NULL)
RETURNS TABLE(
  device_id uuid,
  imei text,
  imei2 text,
  model_id uuid,
  model_name text,
  manufacturer text,
  warranty_months integer,
  is_replaced boolean,
  replaced_at timestamptz,
  has_active_warranty boolean,
  warranty_id uuid,
  warranty_expiry_date date,
  customer_name text,
  customer_phone text,
  store_id uuid,
  store_name text,
  searches_today integer,
  search_limit_reached boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_searches_today integer := 0;
  v_device_id uuid;
  v_rate_limit integer := 50;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT (value->>'value')::integer INTO v_rate_limit
  FROM public.settings WHERE key = 'imei_search_rate_limit' LIMIT 1;
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
        NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text,
        NULL::integer, NULL::boolean, NULL::timestamptz, NULL::boolean,
        NULL::uuid, NULL::date, NULL::text, NULL::text, NULL::uuid, NULL::text,
        v_searches_today, true;
      RETURN;
    END IF;
  END IF;

  SELECT d.id INTO v_device_id
  FROM public.devices d
  WHERE d.imei = p_imei OR d.imei2 = p_imei
  LIMIT 1;

  INSERT INTO public.device_search_log (user_id, search_term, device_found, device_id, ip_address)
  VALUES (v_user_id, p_imei, v_device_id IS NOT NULL, v_device_id, NULLIF(p_user_ip, '')::inet);

  IF v_device_id IS NULL THEN
    RETURN QUERY
    SELECT
      NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text,
      NULL::integer, NULL::boolean, NULL::timestamptz, NULL::boolean,
      NULL::uuid, NULL::date, NULL::text, NULL::text, NULL::uuid, NULL::text,
      v_searches_today + 1, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.imei, d.imei2, d.model_id, dm.model_name, dm.manufacturer, dm.warranty_months,
    d.is_replaced, d.replaced_at,
    EXISTS (
      SELECT 1 FROM public.warranties w
      WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE
    ),
    w.id, w.expiry_date,
    CASE
      WHEN public.is_admin() THEN w.customer_name
      WHEN public.is_store() AND w.store_id = auth.uid() THEN w.customer_name
      WHEN public.is_lab() AND EXISTS (
        SELECT 1 FROM public.repairs r
        WHERE r.device_id = d.id AND r.lab_id = auth.uid() AND r.status IN ('received', 'in_progress')
      ) THEN w.customer_name
      ELSE NULL
    END,
    CASE
      WHEN public.is_admin() THEN w.customer_phone
      WHEN public.is_store() AND w.store_id = auth.uid() THEN w.customer_phone
      WHEN public.is_lab() AND EXISTS (
        SELECT 1 FROM public.repairs r
        WHERE r.device_id = d.id AND r.lab_id = auth.uid() AND r.status IN ('received', 'in_progress')
      ) THEN w.customer_phone
      ELSE NULL
    END,
    CASE WHEN public.is_admin() THEN w.store_id ELSE NULL END,
    CASE WHEN public.is_admin() THEN u.full_name ELSE NULL END,
    v_searches_today + 1,
    false
  FROM public.devices d
  LEFT JOIN public.device_models dm ON d.model_id = dm.id
  LEFT JOIN public.warranties w ON w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE
  LEFT JOIN public.users u ON w.store_id = u.id
  WHERE d.id = v_device_id;
END;
$$;

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
  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id AND is_active = true;
  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT false, 'User not found or inactive.'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT id, store_id, customer_name, customer_phone
  INTO v_warranty_id, v_store_id, v_customer_name, v_customer_phone
  FROM public.warranties
  WHERE device_id = p_device_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_role = 'store' AND (v_store_id IS NULL OR v_store_id <> v_user_id) THEN
    RETURN QUERY SELECT false, 'Permission denied. You can only request replacements for devices you activated.'::text, NULL::uuid;
    RETURN;
  ELSIF v_user_role NOT IN ('store', 'lab') THEN
    RETURN QUERY SELECT false, 'Permission denied for your role.'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.replacement_requests (
    device_id, warranty_id, repair_id, requester_id, reason, customer_name, customer_phone, status
  ) VALUES (
    p_device_id, v_warranty_id, p_repair_id, v_user_id, p_reason,
    COALESCE(v_customer_name, 'N/A'), COALESCE(v_customer_phone, '0500000000'), 'pending'
  )
  RETURNING id INTO v_new_request_id;

  IF p_repair_id IS NOT NULL THEN
    UPDATE public.repairs SET status = 'replacement_requested' WHERE id = p_repair_id;
  END IF;

  RETURN QUERY SELECT true, 'Replacement request created successfully.'::text, v_new_request_id;
END;
$$;

DO $$ BEGIN
  CREATE TYPE public.inventory_status AS ENUM ('in_stock', 'sold', 'at_marketing', 'defective', 'written_off');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_type AS ENUM ('distributor', 'store');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM ('pele', 'marketing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sale_payment_method AS ENUM ('cash', 'transfer', 'check', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sale_payment_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_code text NOT NULL UNIQUE,
  notes text,
  arrived_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cartons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  carton_code text NOT NULL UNIQUE,
  model_id uuid NOT NULL REFERENCES public.device_models(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.distributors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  customer_type public.customer_type NOT NULL DEFAULT 'distributor',
  owner_company public.company_type NOT NULL DEFAULT 'pele',
  phone text,
  email text,
  address text,
  contact_name text,
  business_id text,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  is_active boolean NOT NULL DEFAULT true,
  store_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS carton_id uuid REFERENCES public.cartons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_status public.inventory_status NOT NULL DEFAULT 'in_stock';

CREATE UNIQUE INDEX IF NOT EXISTS distributors_one_store_user
  ON public.distributors(store_user_id) WHERE store_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_inventory_status ON public.devices(inventory_status);
CREATE INDEX IF NOT EXISTS idx_devices_distributor ON public.devices(distributor_id);

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number text NOT NULL UNIQUE,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
  company public.company_type NOT NULL DEFAULT 'pele',
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  total_quantity integer NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  payment_status public.sale_payment_status NOT NULL DEFAULT 'unpaid',
  payment_method public.sale_payment_method,
  invoice_number text,
  delivery_note_number text,
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  UNIQUE (device_id)
);

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method public.sale_payment_method NOT NULL DEFAULT 'transfer',
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collection_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_visits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  visited_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_sale(
  p_distributor_id uuid,
  p_device_ids uuid[],
  p_unit_price numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_count integer;
  v_company public.company_type;
  v_total numeric(12,2);
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'אין הרשאה ליצור מכירה';
  END IF;

  IF p_device_ids IS NULL OR array_length(p_device_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'יש לבחור לפחות מכשיר אחד';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'מחיר לא תקין';
  END IF;

  SELECT owner_company INTO v_company FROM public.distributors WHERE id = p_distributor_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'מפיץ לא נמצא';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.devices
  WHERE id = ANY(p_device_ids) AND inventory_status = 'in_stock' AND is_replaced = false;

  IF v_count <> array_length(p_device_ids, 1) THEN
    RAISE EXCEPTION 'חלק מהמכשירים אינם זמינים למכירה';
  END IF;

  v_total := p_unit_price * v_count;

  INSERT INTO public.sales_orders (
    order_number, distributor_id, company, total_amount, total_quantity, balance_due,
    delivery_note_number, notes, created_by
  ) VALUES (
    'SO-' || to_char(now(), 'YYMMDD-HH24MISS'),
    p_distributor_id,
    v_company,
    v_total,
    v_count,
    v_total,
    'DN-' || to_char(now(), 'YYMMDD-HH24MISS'),
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.sales_order_items (sales_order_id, device_id, unit_price)
  SELECT v_order_id, d.id, p_unit_price
  FROM public.devices d
  WHERE d.id = ANY(p_device_ids);

  UPDATE public.devices
  SET inventory_status = 'sold', distributor_id = p_distributor_id
  WHERE id = ANY(p_device_ids);

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_sale_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method public.sale_payment_method,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric(12,2);
  v_total numeric(12,2);
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'אין הרשאה';
  END IF;

  INSERT INTO public.sale_payments (sales_order_id, amount, method, notes, created_by)
  VALUES (p_order_id, p_amount, p_method, p_notes, auth.uid());

  SELECT total_amount INTO v_total FROM public.sales_orders WHERE id = p_order_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM public.sale_payments WHERE sales_order_id = p_order_id;

  UPDATE public.sales_orders
  SET amount_paid = v_paid,
      balance_due = v_total - v_paid,
      payment_status = CASE
        WHEN v_paid <= 0 THEN 'unpaid'::public.sale_payment_status
        WHEN v_paid + 0.001 < v_total THEN 'partial'::public.sale_payment_status
        ELSE 'paid'::public.sale_payment_status
      END,
      payment_method = p_method
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_devices_to_marketing(p_device_ids uuid[], p_notes text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'אין הרשאה';
  END IF;

  UPDATE public.devices
  SET inventory_status = 'at_marketing'
  WHERE id = ANY(p_device_ids) AND inventory_status = 'in_stock';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_repair_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything" ON public.users;
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
CREATE POLICY "Admins can do everything" ON public.users FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users can read their own data" ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Staff can read users" ON public.users FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid()));

DROP POLICY IF EXISTS "admin_all" ON public.device_models;
DROP POLICY IF EXISTS "public_select" ON public.device_models;
DROP POLICY IF EXISTS "staff_manage_models" ON public.device_models;
CREATE POLICY "staff_manage_models" ON public.device_models FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "public_select" ON public.device_models FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "admin_all" ON public.devices;
DROP POLICY IF EXISTS "authenticated_select" ON public.devices;
DROP POLICY IF EXISTS "staff_manage_devices" ON public.devices;
CREATE POLICY "staff_manage_devices" ON public.devices FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "authenticated_select" ON public.devices FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_all" ON public.repair_types;
DROP POLICY IF EXISTS "public_select" ON public.repair_types;
CREATE POLICY "admin_all" ON public.repair_types FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "public_select" ON public.repair_types FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "admin_all" ON public.lab_repair_prices;
DROP POLICY IF EXISTS "lab_select" ON public.lab_repair_prices;
CREATE POLICY "admin_all" ON public.lab_repair_prices FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "lab_select" ON public.lab_repair_prices FOR SELECT TO authenticated
  USING (public.is_lab() AND lab_id = auth.uid());

DROP POLICY IF EXISTS "admin_all" ON public.warranties;
DROP POLICY IF EXISTS "store_select" ON public.warranties;
DROP POLICY IF EXISTS "lab_select" ON public.warranties;
CREATE POLICY "admin_all" ON public.warranties FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "store_select" ON public.warranties FOR SELECT TO authenticated
  USING (public.is_store() AND store_id = auth.uid());
CREATE POLICY "lab_select" ON public.warranties FOR SELECT TO authenticated
  USING (public.is_lab());
CREATE POLICY "staff_select_warranties" ON public.warranties FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "admin_all" ON public.repairs;
DROP POLICY IF EXISTS "lab_select" ON public.repairs;
DROP POLICY IF EXISTS "lab_insert" ON public.repairs;
DROP POLICY IF EXISTS "lab_update" ON public.repairs;
CREATE POLICY "admin_all" ON public.repairs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "lab_select" ON public.repairs FOR SELECT TO authenticated
  USING (public.is_lab() AND lab_id = auth.uid());
CREATE POLICY "lab_insert" ON public.repairs FOR INSERT TO authenticated
  WITH CHECK (public.is_lab() AND lab_id = auth.uid());
CREATE POLICY "lab_update" ON public.repairs FOR UPDATE TO authenticated
  USING (public.is_lab() AND lab_id = auth.uid())
  WITH CHECK (public.is_lab() AND lab_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view all requests" ON public.replacement_requests;
DROP POLICY IF EXISTS "Admin can update all requests" ON public.replacement_requests;
DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.replacement_requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.replacement_requests;
CREATE POLICY "Admin can view all requests" ON public.replacement_requests FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admin can update all requests" ON public.replacement_requests FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Authenticated users can create requests" ON public.replacement_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Users can view own requests" ON public.replacement_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "admin_all" ON public.payments;
DROP POLICY IF EXISTS "labs_view_own" ON public.payments;
CREATE POLICY "admin_all" ON public.payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "labs_view_own" ON public.payments FOR SELECT TO authenticated
  USING (public.is_lab() AND lab_id = auth.uid());

DROP POLICY IF EXISTS "admin_all" ON public.device_search_log;
DROP POLICY IF EXISTS "users_view_own" ON public.device_search_log;
DROP POLICY IF EXISTS "users_insert_own" ON public.device_search_log;
CREATE POLICY "admin_all" ON public.device_search_log FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "users_view_own" ON public.device_search_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "users_insert_own" ON public.device_search_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Authenticated users can read settings" ON public.settings FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "staff_locations" ON public.locations FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff_batches" ON public.batches FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff_cartons" ON public.cartons FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff_distributors" ON public.distributors FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "store_read_own_distributor" ON public.distributors FOR SELECT TO authenticated
  USING (store_user_id = auth.uid());
CREATE POLICY "staff_sales" ON public.sales_orders FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "store_read_own_sales" ON public.sales_orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.distributors d
    WHERE d.id = sales_orders.distributor_id AND d.store_user_id = auth.uid()
  ));
CREATE POLICY "staff_sale_items" ON public.sales_order_items FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff_sale_payments" ON public.sale_payments FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff_collections" ON public.collection_events FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "staff_visits" ON public.store_visits FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_warranty(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_device_by_imei(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_replacement(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_replacement(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_replacement_request(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_device_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lab_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, uuid[], numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sale_payment(uuid, numeric, public.sale_payment_method, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_devices_to_marketing(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lab() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE OR REPLACE VIEW public.devices_with_status
WITH (security_invoker = true) AS
SELECT
  d.id, d.imei, d.imei2, d.model_id, d.warranty_months, d.is_replaced, d.replaced_at,
  d.imported_by, d.import_batch, d.notes, d.created_at, d.updated_at, dm.model_name,
  CASE
    WHEN d.is_replaced THEN 'replaced'
    WHEN EXISTS (
      SELECT 1 FROM public.warranties w
      WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= CURRENT_DATE
    ) THEN 'active'
    WHEN EXISTS (SELECT 1 FROM public.warranties w WHERE w.device_id = d.id) THEN 'expired'
    ELSE 'new'
  END AS warranty_status
FROM public.devices d
LEFT JOIN public.device_models dm ON d.model_id = dm.id;

CREATE OR REPLACE VIEW public.admin_dashboard_stats
WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*) FROM public.devices WHERE NOT is_replaced) AS total_devices,
  (SELECT COUNT(*) FROM public.warranties WHERE is_active = true AND expiry_date >= CURRENT_DATE) AS active_warranties,
  (SELECT COUNT(*) FROM public.repairs WHERE status IN ('received', 'in_progress')) AS pending_repairs,
  (SELECT COUNT(*) FROM public.replacement_requests WHERE status = 'pending') AS pending_replacements,
  (SELECT COUNT(*) FROM public.users WHERE is_active = true AND role = 'store') AS total_stores,
  (SELECT COUNT(*) FROM public.users WHERE is_active = true AND role = 'lab') AS total_labs;
