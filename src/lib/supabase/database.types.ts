export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          is_active: boolean
          notification_preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          is_active?: boolean
          notification_preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          is_active?: boolean
          notification_preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_models: {
        Row: {
          id: string
          model_name: string
          manufacturer: string | null
          warranty_months: number
          description: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          model_name: string
          manufacturer?: string | null
          warranty_months?: number
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          model_name?: string
          manufacturer?: string | null
          warranty_months?: number
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          imei: string
          imei2: string | null
          model_id: string
          is_replaced: boolean
          replaced_at: string | null
          imported_by: string | null
          import_batch: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          imei: string
          imei2?: string | null
          model_id: string
          is_replaced?: boolean
          replaced_at?: string | null
          imported_by?: string | null
          import_batch?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          imei?: string
          imei2?: string | null
          model_id?: string
          is_replaced?: boolean
          replaced_at?: string | null
          imported_by?: string | null
          import_batch?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          }
        ]
      }
      repair_types: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lab_repair_prices: {
        Row: {
          id: string
          lab_id: string
          repair_type_id: string
          price: number
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          repair_type_id: string
          price: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          repair_type_id?: string
          price?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_repair_prices_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_repair_prices_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          }
        ]
      }
      warranties: {
        Row: {
          id: string
          device_id: string
          store_id: string
          customer_name: string
          customer_phone: string
          activation_date: string
          expiry_date: string
          is_active: boolean
          activated_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          device_id: string
          store_id: string
          customer_name: string
          customer_phone: string
          activation_date?: string
          expiry_date: string
          is_active?: boolean
          activated_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          store_id?: string
          customer_name?: string
          customer_phone?: string
          activation_date?: string
          expiry_date?: string
          is_active?: boolean
          activated_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      repairs: {
        Row: {
          id: string
          device_id: string
          lab_id: string
          warranty_id: string | null
          repair_type_id: string | null
          customer_name: string
          customer_phone: string
          fault_type: Database["public"]["Enums"]["fault_type"] | null
          fault_description: string | null
          status: Database["public"]["Enums"]["repair_status"]
          cost: number | null
          completed_at: string | null
          created_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          device_id: string
          lab_id: string
          warranty_id?: string | null
          repair_type_id?: string | null
          customer_name: string
          customer_phone: string
          fault_type?: Database["public"]["Enums"]["fault_type"] | null
          fault_description?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          cost?: number | null
          completed_at?: string | null
          created_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          lab_id?: string
          warranty_id?: string | null
          repair_type_id?: string | null
          customer_name?: string
          customer_phone?: string
          fault_type?: Database["public"]["Enums"]["fault_type"] | null
          fault_description?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          cost?: number | null
          completed_at?: string | null
          created_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repairs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_repair_type_id_fkey"
            columns: ["repair_type_id"]
            isOneToOne: false
            referencedRelation: "repair_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repairs_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          }
        ]
      }
      replacement_requests: {
        Row: {
          id: string
          device_id: string
          warranty_id: string | null
          repair_id: string | null
          requester_id: string
          customer_name: string
          customer_phone: string
          reason: string
          status: Database["public"]["Enums"]["request_status"]
          admin_notes: string | null
          resolved_by: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          device_id: string
          warranty_id?: string | null
          repair_id?: string | null
          requester_id: string
          customer_name: string
          customer_phone: string
          reason: string
          status?: Database["public"]["Enums"]["request_status"]
          admin_notes?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          warranty_id?: string | null
          repair_id?: string | null
          requester_id?: string
          customer_name?: string
          customer_phone?: string
          reason?: string
          status?: Database["public"]["Enums"]["request_status"]
          admin_notes?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_repair_id_fkey"
            columns: ["repair_id"]
            isOneToOne: false
            referencedRelation: "repairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          id: string
          lab_id: string
          amount: number
          payment_date: string
          reference: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          amount: number
          payment_date?: string
          reference?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          amount?: number
          payment_date?: string
          reference?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      device_search_log: {
        Row: {
          id: string
          user_id: string
          search_term: string
          device_found: boolean
          device_id: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          search_term: string
          device_found: boolean
          device_id?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          search_term?: string
          device_found?: boolean
          device_id?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_search_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_search_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          data: Json | null
          is_read: boolean
          is_opened: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          data?: Json | null
          is_read?: boolean
          is_opened?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          data?: Json | null
          is_read?: boolean
          is_opened?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_log: {
        Row: {
          id: string
          actor_user_id: string
          action: string
          entity_type: string
          entity_id: string
          meta: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_user_id: string
          action: string
          entity_type: string
          entity_id: string
          meta?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_user_id?: string
          action?: string
          entity_type?: string
          entity_id?: string
          meta?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      settings: {
        Row: {
          key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      devices_imei_lookup: {
        Row: {
          id: string
          imei: string
          imei2: string | null
          is_replaced: boolean
          model_name: string
          has_active_warranty: boolean
          has_active_repair: boolean
        }
        Relationships: []
      }
      devices_with_status: {
        Row: {
          id: string
          imei: string
          imei2: string | null
          model_id: string
          is_replaced: boolean
          replaced_at: string | null
          imported_by: string | null
          import_batch: string | null
          notes: string | null
          created_at: string
          updated_at: string
          model_name: string
          warranty_months: number
          warranty_status: string
        }
        Relationships: []
      }
      active_warranties_with_replacements: {
        Row: {
          id: string
          device_id: string
          store_id: string
          customer_name: string
          customer_phone: string
          activation_date: string
          expiry_date: string
          is_active: boolean
          activated_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
          imei: string
          is_replaced: boolean
          model_name: string
          store_name: string | null
          warranty_status: string
          pending_replacements: number
          approved_replacements: number
        }
        Relationships: []
      }
      admin_dashboard_stats: {
        Row: {
          total_devices: number
          active_warranties: number
          pending_repairs: number
          pending_replacements: number
          total_stores: number
          total_labs: number
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_role: {
        Args: Record<string, never>
        Returns: string
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_store: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_lab: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_user_notification_preference: {
        Args: {
          p_user_id: string
          p_preference_key: string
        }
        Returns: boolean
      }
      notify_admins: {
        Args: {
          title: string
          message: string
          type?: string
          data?: Json
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          user_id: string
          title: string
          message: string
          type?: string
          data?: Json
        }
        Returns: undefined
      }
      search_device: {
        Args: {
          search_term: string
        }
        Returns: {
          id: string
          imei: string
          imei2: string | null
          model_name: string
          has_warranty: boolean
        }[]
      }
      get_store_dashboard_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      get_lab_dashboard_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      get_lab_balance: {
        Args: Record<string, never>
        Returns: number
      }
      mark_notifications_as_read: {
        Args: {
          notification_ids: string[]
        }
        Returns: boolean
      }
      mark_notification_as_opened: {
        Args: {
          notification_id: string
        }
        Returns: boolean
      }
      approve_replacement: {
        Args: {
          p_request_id: string
          p_admin_notes?: string
        }
        Returns: {
          success: boolean
          message: string
        }[]
      }
      reject_replacement: {
        Args: {
          p_request_id: string
          p_admin_notes: string
        }
        Returns: {
          success: boolean
          message: string
        }[]
      }
      get_store_device_count: {
        Args: Record<string, never>
        Returns: number
      }
      activate_warranty: {
        Args: {
          p_device_id: string
          p_customer_name: string
          p_customer_phone: string
          p_notes?: string
        }
        Returns: {
          success: boolean
          message: string
          warranty_id: string
          expiry_date: string
        }[]
      }
      create_replacement_request: {
        Args: {
          p_device_id: string
          p_reason: string
          p_repair_id?: string
        }
        Returns: {
          success: boolean
          message: string
        }[]
      }
    }
    Enums: {
      user_role: "admin" | "ops" | "marketing" | "store" | "lab"
      fault_type: "screen" | "charging_port" | "flash" | "speaker" | "board" | "other"
      repair_status: "received" | "in_progress" | "completed" | "replacement_requested" | "cancelled"
      request_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for backward compatibility
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']