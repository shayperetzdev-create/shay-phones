// Import database types
import { Json, Tables } from '@/lib/supabase/database.types';

// Export Json type for use across the app
export type { Json };

// User Types
export type UserRole = 'admin' | 'store' | 'lab';

// Base User type from database
export type User = Tables<'users'>;

// User type aliases for specific roles
export type LabUser = User;
export type StoreUser = User;
export type AdminUser = User;

// Device Types
export type WarrantyStatus = 'new' | 'active' | 'expired' | 'replaced';

// Base Device type from database
export type Device = Tables<'devices'>;

// Device with relations
export interface DeviceWithRelations extends Device {
  warranty?: Warranty;
  repairs?: Repair[];
  model?: DeviceModel;
}

// Device Model type
export type DeviceModel = Tables<'device_models'>;

// Warranty Types
export type Warranty = Tables<'warranties'>;

// Warranty with relations
export interface WarrantyWithRelations extends Warranty {
  device?: {
    id: string;
    imei: string;
    imei2?: string | null;
    device_models?: {
      model_name: string;
    } | null;
    device_model?: {
      model_name: string;
    } | null;
  } | null;
  store?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  repairs?: Array<{
    id: string;
    status: string;
    fault_type?: string;
    lab_id?: string | null;
    created_at?: string;
    completed_at?: string | null;
  }>;
}

// Repair Types
export type RepairStatus = 'received' | 'in_progress' | 'completed' | 'replacement_requested' | 'cancelled';
export type FaultType = 'screen' | 'charging_port' | 'flash' | 'speaker' | 'board' | 'other';

// Base Repair type from database
export type Repair = Tables<'repairs'>;

// Repair with relations
export interface RepairWithRelations extends Repair {
  device?: Device;
  lab?: User;
  warranty?: Warranty;
  repair_type?: RepairType;
}

// Repair Type
export type RepairType = Tables<'repair_types'>;

// Lab Repair Price
export type LabRepairPrice = Tables<'lab_repair_prices'>;

// Replacement Request Types
export type RequestStatus = 'pending' | 'approved' | 'rejected';

// Base ReplacementRequest type from database
export type ReplacementRequest = Tables<'replacement_requests'>;

// ReplacementRequest with relations
export interface ReplacementRequestWithRelations extends ReplacementRequest {
  device?: Device;
  repair?: Repair;
  requester?: User;
  resolver?: User;
  warranty?: Warranty;
}

// Payment Types
export type PaymentStatus = 'pending' | 'paid';

// Base Payment type from database
export type Payment = Tables<'payments'>;

// Payment with relations
export interface PaymentWithRelations extends Payment {
  lab?: User;
  creator?: User;
}

// Audit Log Types
export type AuditLog = Tables<'audit_log'>;

// Audit Log with relations
export interface AuditLogWithRelations extends AuditLog {
  user?: User;
}

// Notification Types
export type Notification = Tables<'notifications'>;

// Settings Types
export type Setting = Tables<'settings'>;

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface DeviceForm {
  imei: string;
  model: string;
  import_batch?: string;
  warranty_months: number;
}

export interface WarrantyActivationForm {
  device_id: string;
  customer_name: string;
  customer_phone: string;
}

export interface RepairForm {
  device_id: string;
  customer_name: string;
  customer_phone: string;
  fault_type: FaultType;
  fault_description?: string;
  cost?: number;
  notes?: string;
  custom_repair_description?: string;
  custom_repair_price?: number;
}

export interface ReplacementRequestForm {
  device_id: string;
  repair_id?: string;
  reason: string;
}

export interface PaymentForm {
  lab_id: string;
  amount: number;
  payment_date: string;
  reference?: string;
  notes?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalDevices: number;
  activeWarranties: number;
  pendingRepairs: number;
  pendingReplacements: number;
  monthlyRevenue?: number;
  recentActivities: Activity[];
}

export interface Activity {
  id: string;
  type: 'warranty_activated' | 'repair_created' | 'replacement_requested' | 'payment_received';
  description: string;
  timestamp: string;
  user?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter Types
export interface DeviceFilters {
  search?: string;
  warranty_status?: WarrantyStatus;
  model?: string;
  import_batch?: string;
}

export interface RepairFilters {
  search?: string;
  status?: RepairStatus;
  fault_type?: FaultType;
  lab_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface WarrantyFilters {
  search?: string;
  store_id?: string;
  is_active?: boolean;
  expiry_from?: string;
  expiry_to?: string;
}

// Chart Data Types
export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  date: string;
  [key: string]: string | number;
}

// Export Types
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  columns?: string[];
  filters?: Record<string, any>;
  dateRange?: {
    from: string;
    to: string;
  };
}