export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: number;
          auth_user_id: string | null;
          emp_code: string;
          entity_id: number | null;
          full_name: string;
          official_email: string;
          personal_email: string | null;
          mobile: string | null;
          phone: string | null;
          department_id: number;
          designation: string;
          employment_type: 'FULL_TIME' | 'CONTRACT' | 'INTERN' | 'FIELD' | 'CONSULTANT' | 'PART_TIME';
          date_of_joining: string | null;
          date_of_exit: string | null;
          work_location: string | null;
          status: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';
          manager_id: number | null;
          avatar_url: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: number;
          auth_user_id?: string | null;
          emp_code: string;
          entity_id?: number | null;
          full_name: string;
          official_email: string;
          personal_email?: string | null;
          mobile?: string | null;
          phone?: string | null;
          department_id: number;
          designation: string;
          employment_type: 'FULL_TIME' | 'CONTRACT' | 'INTERN' | 'FIELD' | 'CONSULTANT' | 'PART_TIME';
          date_of_joining?: string | null;
          date_of_exit?: string | null;
          work_location?: string | null;
          status?: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';
          manager_id?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          auth_user_id?: string | null;
          emp_code?: string;
          entity_id?: number | null;
          full_name?: string;
          official_email?: string;
          personal_email?: string | null;
          mobile?: string | null;
          phone?: string | null;
          department_id?: number;
          designation?: string;
          employment_type?: 'FULL_TIME' | 'CONTRACT' | 'INTERN' | 'FIELD' | 'CONSULTANT' | 'PART_TIME';
          date_of_joining?: string | null;
          date_of_exit?: string | null;
          work_location?: string | null;
          status?: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';
          manager_id?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey";
            columns: ["department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_manager_id_fkey";
            columns: ["manager_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      employee_roles: {
        Row: {
          id: number;
          employee_id: number;
          role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';
          created_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';
          created_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          role?: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_roles_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      departments: {
        Row: {
          id: number;
          entity_id: number;
          name: string;
          head_id: number | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          entity_id?: number;
          name: string;
          head_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          entity_id?: number;
          name?: string;
          head_id?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_head_id_fkey";
            columns: ["head_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      leave_types: {
        Row: {
          id: number;
          entity_id: number | null;
          code: string;
          name: string;
          annual_quota: number;
          accrual_mode: 'MONTHLY' | 'ANNUAL' | 'NONE' | null;
          accrual_per_month: number | null;
          carry_forward_max: number;
          encashable: boolean | null;
          allows_half_day: boolean | null;
          allow_half_day: boolean | null;
          requires_document: boolean | null;
          requires_document_after_days: number | null;
          min_notice_days: number | null;
          is_paid: boolean | null;
          probation_eligible: boolean | null;
          sandwich_rule: boolean | null;
          active: boolean | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          entity_id?: number | null;
          code: string;
          name: string;
          annual_quota: number;
          accrual_mode?: 'MONTHLY' | 'ANNUAL' | 'NONE' | null;
          accrual_per_month?: number | null;
          carry_forward_max?: number;
          encashable?: boolean | null;
          allows_half_day?: boolean | null;
          allow_half_day?: boolean | null;
          requires_document?: boolean | null;
          requires_document_after_days?: number | null;
          min_notice_days?: number | null;
          is_paid?: boolean | null;
          probation_eligible?: boolean | null;
          sandwich_rule?: boolean | null;
          active?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          entity_id?: number | null;
          code?: string;
          name?: string;
          annual_quota?: number;
          accrual_mode?: 'MONTHLY' | 'ANNUAL' | 'NONE' | null;
          accrual_per_month?: number | null;
          carry_forward_max?: number;
          encashable?: boolean | null;
          allows_half_day?: boolean | null;
          allow_half_day?: boolean | null;
          requires_document?: boolean | null;
          requires_document_after_days?: number | null;
          min_notice_days?: number | null;
          is_paid?: boolean | null;
          probation_eligible?: boolean | null;
          sandwich_rule?: boolean | null;
          active?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
      leave_balances: {
        Row: {
          id: number;
          employee_id: number;
          leave_type_id: number;
          fy_year: string;
          opening: number;
          accrued: number;
          used: number;
          reserved: number;
          encashed: number;
          lapsed: number;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          leave_type_id: number;
          fy_year: string;
          opening?: number;
          accrued?: number;
          used?: number;
          reserved?: number;
          encashed?: number;
          lapsed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          leave_type_id?: number;
          fy_year?: string;
          opening?: number;
          accrued?: number;
          used?: number;
          reserved?: number;
          encashed?: number;
          lapsed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey";
            columns: ["leave_type_id"];
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          }
        ];
      };
      leave_requests: {
        Row: {
          id: number;
          employee_id: number;
          leave_type_id: number;
          from_date: string;
          to_date: string;
          from_half: 'FIRST_HALF' | 'SECOND_HALF' | null;
          to_half: 'FIRST_HALF' | 'SECOND_HALF' | null;
          total_days: number;
          reason: string;
          contact_during: string | null;
          document_url: string | null;
          document_name: string | null;
          status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
          current_level: number;
          current_approver_id: number | null;
          applied_at: string;
          closed_at: string | null;
          timeline: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          leave_type_id: number;
          from_date: string;
          to_date: string;
          from_half?: 'FIRST_HALF' | 'SECOND_HALF' | null;
          to_half?: 'FIRST_HALF' | 'SECOND_HALF' | null;
          total_days: number;
          reason: string;
          contact_during?: string | null;
          document_url?: string | null;
          document_name?: string | null;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
          current_level?: number;
          current_approver_id?: number | null;
          applied_at?: string;
          closed_at?: string | null;
          timeline?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          leave_type_id?: number;
          from_date?: string;
          to_date?: string;
          from_half?: 'FIRST_HALF' | 'SECOND_HALF' | null;
          to_half?: 'FIRST_HALF' | 'SECOND_HALF' | null;
          total_days?: number;
          reason?: string;
          contact_during?: string | null;
          document_url?: string | null;
          document_name?: string | null;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
          current_level?: number;
          current_approver_id?: number | null;
          applied_at?: string;
          closed_at?: string | null;
          timeline?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey";
            columns: ["leave_type_id"];
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_current_approver_id_fkey";
            columns: ["current_approver_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      holidays: {
        Row: {
          id: number;
          entity_id: number | null;
          holiday_date: string;
          name: string;
          is_optional: boolean | null;
          is_restricted: boolean | null;
          holiday_year: number | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          entity_id?: number | null;
          holiday_date: string;
          name: string;
          is_optional?: boolean | null;
          is_restricted?: boolean | null;
          holiday_year?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          entity_id?: number | null;
          holiday_date?: string;
          name?: string;
          is_optional?: boolean | null;
          is_restricted?: boolean | null;
          holiday_year?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: number;
          employee_id: number;
          work_date: string;
          shift_id: number;
          punch_in: string | null;
          punch_out: string | null;
          in_lat: number | null;
          in_lng: number | null;
          out_lat: number | null;
          out_lng: number | null;
          in_source: 'WEB' | 'MOBILE' | 'WHATSAPP' | 'BIOMETRIC' | 'MANUAL' | null;
          worked_hours: number | null;
          status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'LOP';
          leave_request_id: number | null;
          is_regularized: boolean;
          remarks: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          work_date: string;
          shift_id?: number;
          punch_in?: string | null;
          punch_out?: string | null;
          in_lat?: number | null;
          in_lng?: number | null;
          out_lat?: number | null;
          out_lng?: number | null;
          in_source?: 'WEB' | 'MOBILE' | 'WHATSAPP' | 'BIOMETRIC' | 'MANUAL' | null;
          worked_hours?: number | null;
          status?: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'LOP';
          leave_request_id?: number | null;
          is_regularized?: boolean;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          work_date?: string;
          shift_id?: number;
          punch_in?: string | null;
          punch_out?: string | null;
          in_lat?: number | null;
          in_lng?: number | null;
          out_lat?: number | null;
          out_lng?: number | null;
          in_source?: 'WEB' | 'MOBILE' | 'WHATSAPP' | 'BIOMETRIC' | 'MANUAL' | null;
          worked_hours?: number | null;
          status?: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'WEEK_OFF' | 'HOLIDAY' | 'LOP';
          leave_request_id?: number | null;
          is_regularized?: boolean;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      attendance_regularizations: {
        Row: {
          id: number;
          attendance_id: number | null;
          employee_id: number;
          work_date: string;
          requested_in: string;
          requested_out: string;
          reason: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          approver_id: number | null;
          acted_at: string | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          attendance_id?: number | null;
          employee_id: number;
          work_date: string;
          requested_in: string;
          requested_out: string;
          reason: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          approver_id?: number | null;
          acted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          attendance_id?: number | null;
          employee_id?: number;
          work_date?: string;
          requested_in?: string;
          requested_out?: string;
          reason?: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          approver_id?: number | null;
          acted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_regularizations_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_regularizations_approver_id_fkey";
            columns: ["approver_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      monthly_attendance_summaries: {
        Row: {
          id: number;
          employee_id: number;
          year: number;
          month: number;
          total_days: number | null;
          present_days: number;
          leave_days: number;
          week_off_days: number | null;
          holiday_days: number | null;
          lop_days: number;
          payable_days: number;
          locked: boolean;
          locked_by: string | null;
          locked_at: string | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          year: number;
          month: number;
          total_days?: number | null;
          present_days?: number;
          leave_days?: number;
          week_off_days?: number | null;
          holiday_days?: number | null;
          lop_days?: number;
          payable_days?: number;
          locked?: boolean;
          locked_by?: string | null;
          locked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          year?: number;
          month?: number;
          total_days?: number | null;
          present_days?: number;
          leave_days?: number;
          week_off_days?: number | null;
          holiday_days?: number | null;
          lop_days?: number;
          payable_days?: number;
          locked?: boolean;
          locked_by?: string | null;
          locked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_attendance_summaries_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      kpi_cycles: {
        Row: {
          id: number;
          entity_id: number | null;
          name: string;
          start_date: string;
          end_date: string;
          self_review_due: string | null;
          manager_review_due: string | null;
          status: 'DRAFT' | 'OPEN' | 'SELF_DONE' | 'REVIEW' | 'CLOSED';
          created_at?: string;
        };
        Insert: {
          id?: number;
          entity_id?: number | null;
          name: string;
          start_date: string;
          end_date: string;
          self_review_due?: string | null;
          manager_review_due?: string | null;
          status?: 'DRAFT' | 'OPEN' | 'SELF_DONE' | 'REVIEW' | 'CLOSED';
          created_at?: string;
        };
        Update: {
          id?: number;
          entity_id?: number | null;
          name?: string;
          start_date?: string;
          end_date?: string;
          self_review_due?: string | null;
          manager_review_due?: string | null;
          status?: 'DRAFT' | 'OPEN' | 'SELF_DONE' | 'REVIEW' | 'CLOSED';
          created_at?: string;
        };
        Relationships: [];
      };
      kpi_definitions: {
        Row: {
          id: number;
          cycle_id: number;
          employee_id: number;
          title: string;
          metric_unit: string;
          target_value: number;
          weight_pct: number;
          created_by: number;
          created_at?: string;
        };
        Insert: {
          id?: number;
          cycle_id: number;
          employee_id: number;
          title: string;
          metric_unit: string;
          target_value: number;
          weight_pct: number;
          created_by: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          cycle_id?: number;
          employee_id?: number;
          title?: string;
          metric_unit?: string;
          target_value?: number;
          weight_pct?: number;
          created_by?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_cycle_id_fkey";
            columns: ["cycle_id"];
            referencedRelation: "kpi_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kpi_definitions_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      kpi_scores: {
        Row: {
          id: number;
          kpi_id: number;
          actual_value: number | null;
          self_rating: number | null;
          self_comment: string | null;
          manager_rating: number | null;
          manager_comment: string | null;
          final_rating: number | null;
          submitted_at: string | null;
          reviewed_at: string | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          kpi_id: number;
          actual_value?: number | null;
          self_rating?: number | null;
          self_comment?: string | null;
          manager_rating?: number | null;
          manager_comment?: string | null;
          final_rating?: number | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          kpi_id?: number;
          actual_value?: number | null;
          self_rating?: number | null;
          self_comment?: string | null;
          manager_rating?: number | null;
          manager_comment?: string | null;
          final_rating?: number | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kpi_scores_kpi_id_fkey";
            columns: ["kpi_id"];
            referencedRelation: "kpi_definitions";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: number;
          timestamp: string;
          actor_id: number | null;
          actor_name: string | null;
          actor_role: string | null;
          module: 'AUTH' | 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'KPI' | 'PAYROLL' | 'ROLES' | null;
          action: string;
          entity_type: string | null;
          entity_id: number | null;
          details: string;
          ip_address: string | null;
        };
        Insert: {
          id?: number;
          timestamp?: string;
          actor_id?: number | null;
          actor_name?: string | null;
          actor_role?: string | null;
          module?: 'AUTH' | 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'KPI' | 'PAYROLL' | 'ROLES' | null;
          action: string;
          entity_type?: string | null;
          entity_id?: number | null;
          details: string;
          ip_address?: string | null;
        };
        Update: {
          id?: number;
          timestamp?: string;
          actor_id?: number | null;
          actor_name?: string | null;
          actor_role?: string | null;
          module?: 'AUTH' | 'EMPLOYEE' | 'ATTENDANCE' | 'LEAVE' | 'KPI' | 'PAYROLL' | 'ROLES' | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: number | null;
          details?: string;
          ip_address?: string | null;
        };
        Relationships: [];
      };
      role_proposals: {
        Row: {
          id: number;
          target_user_id: number;
          target_user_name: string;
          target_user_email: string;
          proposed_role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';
          justification: string;
          proposed_by_name: string;
          proposed_at: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
        };
        Insert: {
          id?: number;
          target_user_id: number;
          target_user_name: string;
          target_user_email: string;
          proposed_role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';
          justification: string;
          proposed_by_name: string;
          proposed_at?: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
        };
        Update: {
          id?: number;
          target_user_id?: number;
          target_user_name?: string;
          target_user_email?: string;
          proposed_role?: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'CEO' | 'SYSTEM_ADMIN';
          justification?: string;
          proposed_by_name?: string;
          proposed_at?: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
        };
        Relationships: [];
      };
      system_users: {
        Row: {
          id: number;
          employee_id: number;
          is_locked: boolean;
          last_login: string | null;
          created_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          is_locked?: boolean;
          last_login?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          is_locked?: boolean;
          last_login?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_users_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
