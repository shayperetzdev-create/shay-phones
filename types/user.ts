// types/user.ts

// --- Enums from database.sql ---
// שימוש בטיפוסים אלו יבטיח עקביות וימנע שגיאות הקלדה
export type UserRole = 'admin' | 'ops' | 'marketing' | 'store' | 'lab';
export type WarrantyStatus = 'new' | 'active' | 'expired' | 'replaced';
export type RepairStatus = 'received' | 'in_progress' | 'completed' | 'replacement_requested';
export type FaultType = 'screen' | 'charging_port' | 'flash' | 'speaker' | 'board' | 'other';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'paid';


// --- Base Table Interfaces ---
// ממשקים אלו מייצגים שורה בודדת בכל טבלה במסד הנתונים

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  imei: string;
  imei2: string | null;
  model: string;
  import_batch: string | null;
  warranty_status: WarrantyStatus;
  warranty_months: number;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Warranty {
  id: string;
  device_id: string;
  store_id: string | null;
  customer_name: string;
  customer_phone: string;
  activation_date: string;
  expiry_date: string;
  is_active: boolean;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Repair {
  id: string;
  device_id: string;
  lab_id: string | null;
  warranty_id: string | null;
  customer_name: string;
  customer_phone: string;
  fault_type: FaultType;
  fault_description: string | null;
  status: RepairStatus;
  cost: number | null;
  created_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReplacementRequest {
  id: string;
  device_id: string;
  repair_id: string | null;
  requester_id: string | null;
  customer_name: string;
  customer_phone: string;
  reason: string;
  status: RequestStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  lab_id: string | null;
  amount: number;
  payment_date: string;
  reference: string | null;
  status: PaymentStatus;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}


// --- Extended Interfaces for Joined Queries ---
// ממשקים אלו מייצגים את מבנה הנתונים לאחר ביצוע JOIN בשאילתות Supabase

export type UserData = User;

export interface WarrantyWithDetails extends Warranty {
  device?: Device;
  store?: User;
}

export interface RepairWithDetails extends Repair {
  device?: Device;
  lab?: User;
  warranty?: Warranty;
}

export interface ReplacementRequestWithDetails extends ReplacementRequest {
  device?: Device & { warranty?: WarrantyWithDetails };
  repair?: RepairWithDetails;
  requester?: UserData;
  resolver?: UserData;
}

export interface DeviceWithDetails extends Device {
  warranties?: Warranty[];
  repairs?: Repair[];
}