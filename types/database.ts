// Types for the Supabase schema in supabase/migrations.
// Shape matches `supabase gen types typescript`; regenerate with `npm run db:types`
// once the project is linked, and keep this file in sync with the migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          company_name: string
          timezone: string
          weekend_days: number[]
          max_backdate_days: number
          max_advance_days: number
          updated_at: string
        }
        Insert: never
        Update: {
          company_name?: string
          timezone?: string
          weekend_days?: number[]
          max_backdate_days?: number
          max_advance_days?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          full_name: string
          email: string
          avatar_url: string | null
          is_active: boolean
        } & Timestamps
        Insert: never
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          full_name?: string
          avatar_url?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      departments: {
        Row: { id: string; name: string } & Timestamps
        Insert: { id?: string; name: string }
        Update: { name?: string }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          profile_id: string | null
          employee_code: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          department_id: string | null
          designation: string | null
          joining_date: string
          status: Database["public"]["Enums"]["employee_status"]
        } & Timestamps
        Insert: {
          id?: string
          employee_code: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          department_id?: string | null
          designation?: string | null
          joining_date: string
          status?: Database["public"]["Enums"]["employee_status"]
        }
        Update: {
          employee_code?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          department_id?: string | null
          designation?: string | null
          joining_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          id: string
          name: string
          description: string | null
          default_days: number
          requires_balance: boolean
          is_active: boolean
          sort_order: number
        } & Timestamps
        Insert: {
          id?: string
          name: string
          description?: string | null
          default_days?: number
          requires_balance?: boolean
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          description?: string | null
          default_days?: number
          requires_balance?: boolean
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          id: string
          employee_id: string
          leave_type_id: string
          year: number
          allocated_days: number
          used_days: number
          remaining_days: number
        } & Timestamps
        Insert: {
          id?: string
          employee_id: string
          leave_type_id: string
          year: number
          allocated_days?: number
        }
        Update: { allocated_days?: number }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          id: string
          employee_id: string
          leave_type_id: string
          start_date: string
          end_date: string
          total_days: number
          leave_year: number
          reason: string
          status: Database["public"]["Enums"]["leave_status"]
          rejection_reason: string | null
          cancellation_reason: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          cancelled_at: string | null
        } & Timestamps
        // total_days, status and review fields are always set by the database.
        Insert: {
          employee_id: string
          leave_type_id: string
          start_date: string
          end_date: string
          reason: string
          total_days?: number
        }
        Update: never
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          id: string
          name: string
          holiday_date: string
          description: string | null
          is_optional: boolean
        } & Timestamps
        Insert: {
          id?: string
          name: string
          holiday_date: string
          description?: string | null
          is_optional?: boolean
        }
        Update: {
          name?: string
          holiday_date?: string
          description?: string | null
          is_optional?: boolean
        }
        Relationships: []
      }
      payslips: {
        Row: PayrollRow & { month: number }
        Insert: PayrollInsert & { month: number }
        Update: PayrollUpdate
        Relationships: PayrollRelationships<"payslips">
      }
      ytd_reports: {
        Row: PayrollRow
        Insert: PayrollInsert
        Update: PayrollUpdate
        Relationships: PayrollRelationships<"ytd_reports">
      }
      pf_ytd_reports: {
        Row: PayrollRow
        Insert: PayrollInsert
        Update: PayrollUpdate
        Relationships: PayrollRelationships<"pf_ytd_reports">
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: Database["public"]["Enums"]["notification_type"]
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: never
        Update: { is_read?: boolean }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: number
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          subject_employee_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_subject_employee_id_fkey"
            columns: ["subject_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leave_balance_summary: {
        Row: {
          id: string
          employee_id: string
          leave_type_id: string
          year: number
          allocated_days: number
          used_days: number
          remaining_days: number
          pending_days: number
          available_days: number
          updated_at: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_leave_days: {
        Args: { p_start_date: string; p_end_date: string }
        Returns: number
      }
      cancel_leave_request: {
        Args: { p_request_id: string }
        Returns: Database["public"]["Tables"]["leave_requests"]["Row"]
      }
      review_leave_request: {
        Args: { p_request_id: string; p_decision: "approved" | "rejected"; p_rejection_reason?: string | null }
        Returns: Database["public"]["Tables"]["leave_requests"]["Row"]
      }
      revoke_leave_request: {
        Args: { p_request_id: string; p_reason: string }
        Returns: Database["public"]["Tables"]["leave_requests"]["Row"]
      }
      allocate_leave_for_year: {
        Args: { p_year: number }
        Returns: number
      }
      update_my_phone: {
        Args: { p_phone: string | null }
        Returns: undefined
      }
      get_admin_dashboard: {
        Args: never
        Returns: Json
      }
      report_leave_summary: {
        Args: { p_year: number }
        Returns: {
          leave_type_id: string
          leave_type: string
          requires_balance: boolean
          employees: number
          allocated_days: number
          used_days: number
          pending_days: number
          approved_requests: number
          rejected_requests: number
        }[]
      }
      report_payroll_status: {
        Args: { p_year: number; p_month: number; p_limit?: number; p_offset?: number }
        Returns: {
          employee_id: string
          employee_code: string
          full_name: string
          department: string | null
          has_payslip: boolean
          has_ytd_report: boolean
          has_pf_ytd_report: boolean
          total_count: number
        }[]
      }
      record_sign_in: {
        Args: never
        Returns: undefined
      }
      service_link_employee_profile: {
        Args: { p_employee_id: string; p_profile_id: string; p_actor_id: string | null }
        Returns: undefined
      }
      service_log_event: {
        Args: {
          p_actor_id: string | null
          p_action: string
          p_entity_type: string
          p_entity_id: string | null
          p_subject_employee_id?: string | null
          p_metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      employee_status: "active" | "inactive"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      notification_type:
        | "leave_approved"
        | "leave_rejected"
        | "leave_revoked"
        | "payslip_available"
        | "ytd_report_available"
        | "pf_ytd_report_available"
        | "holiday_added"
    }
    CompositeTypes: Record<string, never>
  }
}

type PayrollRow = {
  id: string
  employee_id: string
  year: number
  file_path: string
  file_name: string
  file_size: number
  uploaded_by: string | null
} & Timestamps

type PayrollInsert = {
  id?: string
  employee_id: string
  year: number
  file_path: string
  file_name: string
  file_size: number
  uploaded_by?: string | null
}

type PayrollUpdate = {
  file_path?: string
  file_name?: string
  file_size?: number
  uploaded_by?: string | null
}

type PayrollRelationships<T extends string> = [
  {
    foreignKeyName: `${T}_employee_id_fkey`
    columns: ["employee_id"]
    isOneToOne: false
    referencedRelation: "employees"
    referencedColumns: ["id"]
  },
  {
    foreignKeyName: `${T}_uploaded_by_fkey`
    columns: ["uploaded_by"]
    isOneToOne: false
    referencedRelation: "profiles"
    referencedColumns: ["id"]
  },
]

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export type AppRole = Enums<"app_role">
export type LeaveStatus = Enums<"leave_status">
export type EmployeeStatus = Enums<"employee_status">
