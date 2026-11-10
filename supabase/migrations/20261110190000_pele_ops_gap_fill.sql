-- Fill Pele operational gaps: returns, write-offs, settlements, field, van, finance, attendance, activity, permissions.

-- Extend inventory primitives
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0);

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'warehouse'
    CHECK (location_type IN ('warehouse', 'van', 'marketing', 'other')),
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0);

ALTER TABLE public.store_visits
  ADD COLUMN IF NOT EXISTS visited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome text;

DO $$ BEGIN
  CREATE TYPE public.return_condition AS ENUM ('resalable', 'defective');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.write_off_reason AS ENUM ('lost', 'damaged', 'donation', 'demo', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_status AS ENUM ('draft', 'approved', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.check_status AS ENUM ('pending', 'deposited', 'cleared', 'bounced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.simulation_status AS ENUM ('draft', 'approved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number text NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  condition public.return_condition NOT NULL DEFAULT 'resalable',
  credit_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  UNIQUE (device_id)
);

CREATE TABLE IF NOT EXISTS public.write_offs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  write_off_number text NOT NULL UNIQUE,
  reason_type public.write_off_reason NOT NULL DEFAULT 'other',
  write_off_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.write_off_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  write_off_id uuid NOT NULL REFERENCES public.write_offs(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  previous_status public.inventory_status,
  UNIQUE (device_id)
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_number text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status public.settlement_status NOT NULL DEFAULT 'draft',
  total_units integer NOT NULL DEFAULT 0,
  total_amount_due numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.settlement_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id uuid NOT NULL REFERENCES public.settlements(id) ON DELETE CASCADE,
  model_id uuid REFERENCES public.device_models(id) ON DELETE SET NULL,
  model_label text NOT NULL,
  units integer NOT NULL DEFAULT 0 CHECK (units >= 0),
  price_per_device numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_per_device >= 0),
  subtotal numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.store_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  rep_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (distributor_id, rep_user_id)
);

CREATE TABLE IF NOT EXISTS public.sales_targets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rep_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  target_units integer NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  target_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  UNIQUE (rep_user_id, period_month)
);

CREATE TABLE IF NOT EXISTS public.sale_expected_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_checks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  check_number text,
  check_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status public.check_status NOT NULL DEFAULT 'pending',
  bank_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.target_profits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id uuid NOT NULL REFERENCES public.device_models(id) ON DELETE CASCADE,
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE CASCADE,
  for_marketing boolean NOT NULL DEFAULT false,
  target_profit_per_device numeric(12,2) NOT NULL DEFAULT 0,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_simulations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  status public.simulation_status NOT NULL DEFAULT 'draft',
  model_id uuid REFERENCES public.device_models(id) ON DELETE SET NULL,
  landed_cost numeric(12,2) NOT NULL DEFAULT 0,
  wholesale_price numeric(12,2) NOT NULL DEFAULT 0,
  retail_price numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.simulation_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_id uuid NOT NULL REFERENCES public.pricing_simulations(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.attendance_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  note text,
  UNIQUE (user_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role public.user_role NOT NULL,
  permission text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  UNIQUE (role, permission)
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.activity_feed
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.created_at,
  a.entity,
  a.entity_id,
  a.action,
  a.summary,
  u.full_name AS actor_name,
  u.email AS actor_email
FROM public.activity_log a
LEFT JOIN public.users u ON u.id = a.actor_id
ORDER BY a.created_at DESC;

CREATE OR REPLACE VIEW public.device_ageing
WITH (security_invoker = true)
AS
SELECT
  d.id AS device_id,
  d.imei,
  d.inventory_status,
  d.model_id,
  m.model_name,
  c.carton_code,
  b.batch_code,
  b.arrived_at,
  COALESCE(b.arrived_at, d.created_at::date) AS stock_since,
  (CURRENT_DATE - COALESCE(b.arrived_at, d.created_at::date)) AS days_in_stock,
  CASE
    WHEN (CURRENT_DATE - COALESCE(b.arrived_at, d.created_at::date)) <= 30 THEN '0-30'
    WHEN (CURRENT_DATE - COALESCE(b.arrived_at, d.created_at::date)) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - COALESCE(b.arrived_at, d.created_at::date)) <= 90 THEN '61-90'
    ELSE '90+'
  END AS age_bucket
FROM public.devices d
LEFT JOIN public.device_models m ON m.id = d.model_id
LEFT JOIN public.cartons c ON c.id = d.carton_id
LEFT JOIN public.batches b ON b.id = c.batch_id
WHERE d.inventory_status IN ('in_stock', 'at_marketing')
  AND d.is_replaced = false;

CREATE OR REPLACE VIEW public.debt_by_distributor
WITH (security_invoker = true)
AS
SELECT
  dist.id AS distributor_id,
  dist.name,
  COUNT(o.id) AS open_orders,
  COALESCE(SUM(o.balance_due), 0) AS total_due,
  MIN(o.due_date) AS earliest_due
FROM public.distributors dist
LEFT JOIN public.sales_orders o
  ON o.distributor_id = dist.id AND o.balance_due > 0
GROUP BY dist.id, dist.name;

CREATE OR REPLACE FUNCTION public.log_activity(
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_summary text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, entity, entity_id, action, summary)
  VALUES (auth.uid(), p_entity, p_entity_id, p_action, p_summary);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_return(
  p_sales_order_id uuid,
  p_device_ids uuid[],
  p_condition public.return_condition DEFAULT 'resalable',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_number text;
  v_credit numeric(12,2) := 0;
  v_device uuid;
  v_price numeric(12,2);
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'אין הרשאה';
  END IF;

  v_number := 'RET-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  INSERT INTO public.returns (return_number, sales_order_id, condition, notes, created_by)
  VALUES (v_number, p_sales_order_id, p_condition, p_notes, auth.uid())
  RETURNING id INTO v_id;

  FOREACH v_device IN ARRAY p_device_ids LOOP
    SELECT unit_price INTO v_price
    FROM public.sales_order_items
    WHERE sales_order_id = p_sales_order_id AND device_id = v_device;

    IF v_price IS NULL THEN
      RAISE EXCEPTION 'המכשיר לא שייך להזמנה';
    END IF;

    INSERT INTO public.return_items (return_id, device_id, unit_price)
    VALUES (v_id, v_device, v_price);

    UPDATE public.devices
    SET inventory_status = CASE WHEN p_condition = 'defective' THEN 'defective'::public.inventory_status ELSE 'in_stock'::public.inventory_status END,
        distributor_id = NULL
    WHERE id = v_device;

    v_credit := v_credit + v_price;
  END LOOP;

  UPDATE public.returns SET credit_amount = v_credit WHERE id = v_id;
  UPDATE public.sales_orders
  SET credit_amount = credit_amount + v_credit,
      balance_due = GREATEST(0, balance_due - v_credit),
      amount_paid = amount_paid
  WHERE id = p_sales_order_id;

  PERFORM public.log_activity('returns', v_id, 'create', 'החזרה ' || v_number);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_write_off(
  p_device_ids uuid[],
  p_reason public.write_off_reason DEFAULT 'other',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_number text;
  v_device uuid;
  v_prev public.inventory_status;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'אין הרשאה';
  END IF;

  v_number := 'WO-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  INSERT INTO public.write_offs (write_off_number, reason_type, notes, created_by)
  VALUES (v_number, p_reason, p_notes, auth.uid())
  RETURNING id INTO v_id;

  FOREACH v_device IN ARRAY p_device_ids LOOP
    SELECT inventory_status INTO v_prev FROM public.devices WHERE id = v_device;
    IF v_prev IS NULL OR v_prev = 'written_off' THEN
      RAISE EXCEPTION 'לא ניתן להוציא מכשיר מהמלאי';
    END IF;
    INSERT INTO public.write_off_items (write_off_id, device_id, previous_status)
    VALUES (v_id, v_device, v_prev);
    UPDATE public.devices SET inventory_status = 'written_off' WHERE id = v_device;
  END LOOP;

  PERFORM public.log_activity('write_offs', v_id, 'create', 'הוצאה מהמלאי ' || v_number);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_cartons_to_location(
  p_carton_ids uuid[],
  p_location_id uuid
) RETURNS integer
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
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_location_id) THEN
    RAISE EXCEPTION 'מיקום לא נמצא';
  END IF;

  UPDATE public.cartons
  SET location_id = p_location_id
  WHERE id = ANY(p_carton_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.log_activity('cartons', p_location_id, 'move', 'הועברו ' || v_count || ' קרטונים');
  RETURN v_count;
END;
$$;

-- Seed basic permission matrix for staff roles
INSERT INTO public.role_permissions (role, permission, can_view, can_edit)
SELECT r.role, p.permission, true, (r.role = 'admin')
FROM (VALUES
  ('admin'::public.user_role),
  ('ops'::public.user_role),
  ('marketing'::public.user_role)
) AS r(role)
CROSS JOIN (VALUES
  ('inventory'),('sales'),('returns'),('writeoff'),('collections'),
  ('consignment'),('settlement'),('field_sales'),('van_stock'),
  ('finance'),('cashflow'),('attendance_report'),('employees'),('audit')
) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;

UPDATE public.role_permissions
SET can_edit = true
WHERE role IN ('admin', 'ops')
  AND permission IN ('inventory','sales','returns','writeoff','collections','consignment','settlement','finance');

UPDATE public.role_permissions
SET can_edit = true
WHERE role = 'marketing'
  AND permission IN ('field_sales','van_stock','collections');

-- RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.write_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.write_off_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_expected_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_profits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'returns','return_items','write_offs','write_off_items','settlements','settlement_lines',
    'store_assignments','sales_targets','sale_expected_payments','sale_checks','target_profits',
    'pricing_simulations','simulation_lines','attendance_entries','role_permissions','activity_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS staff_all_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY staff_all_%s ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
      t, t
    );
  END LOOP;
END $$;

-- Users can clock themselves; staff can see all attendance
DROP POLICY IF EXISTS staff_all_attendance_entries ON public.attendance_entries;
CREATE POLICY attendance_own_or_staff ON public.attendance_entries
  FOR ALL TO authenticated
  USING (public.is_staff() OR user_id = auth.uid())
  WITH CHECK (public.is_staff() OR user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.returns, public.return_items, public.write_offs, public.write_off_items,
  public.settlements, public.settlement_lines, public.store_assignments, public.sales_targets,
  public.sale_expected_payments, public.sale_checks, public.target_profits,
  public.pricing_simulations, public.simulation_lines, public.attendance_entries,
  public.role_permissions, public.activity_log
TO authenticated;

GRANT SELECT ON public.activity_feed, public.device_ageing, public.debt_by_distributor TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_return(uuid, uuid[], public.return_condition, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_write_off(uuid[], public.write_off_reason, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_cartons_to_location(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, uuid, text, text) TO authenticated;
