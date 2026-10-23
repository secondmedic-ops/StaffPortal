export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Compact table definition for tables added by the staff-lifecycle migration. */
type LifecycleTable<
  Row extends Record<string, unknown>,
  RequiredOnInsert extends keyof Row,
  Rel extends Array<{
    foreignKeyName: string;
    columns: string[];
    referencedRelation: string;
    referencedColumns: string[];
  }> = []
> = {
  Row: Row;
  Insert: Pick<Row, RequiredOnInsert> & Partial<Omit<Row, RequiredOnInsert>>;
  Update: Partial<Row>;
  Relationships: Rel;
};

type EmployeeFk<Name extends string, Col extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  referencedRelation: 'employees';
  referencedColumns: ['id'];
};

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
          division: string | null;
          status: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';
          manager_id: number | null;
          avatar_url: string | null;
          branch_id?: number | null;
          probation_end_date?: string | null;
          confirmation_date?: string | null;
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
          division?: string | null;
          status?: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';
          manager_id?: number | null;
          avatar_url?: string | null;
          branch_id?: number | null;
          probation_end_date?: string | null;
          confirmation_date?: string | null;
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
          division?: string | null;
          status?: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'EXITED' | 'SUSPENDED';
          manager_id?: number | null;
          avatar_url?: string | null;
          branch_id?: number | null;
          probation_end_date?: string | null;
          confirmation_date?: string | null;
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
          role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'IT' | 'CEO' | 'SYSTEM_ADMIN' | 'DIRECTOR';
          created_at?: string;
        };
        Insert: {
          id?: number;
          employee_id: number;
          role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'IT' | 'CEO' | 'SYSTEM_ADMIN' | 'DIRECTOR';
          created_at?: string;
        };
        Update: {
          id?: number;
          employee_id?: number;
          role?: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'IT' | 'CEO' | 'SYSTEM_ADMIN' | 'DIRECTOR';
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
          work_mode?: 'OFFICE' | 'WFH' | 'FIELD';
          visit_location?: string | null;
          visit_purpose?: string | null;
          visit_client?: string | null;
          distance_m?: number | null;
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
          proposed_role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'IT' | 'CEO' | 'SYSTEM_ADMIN' | 'DIRECTOR';
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
          proposed_role: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'IT' | 'CEO' | 'SYSTEM_ADMIN' | 'DIRECTOR';
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
          proposed_role?: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTS' | 'IT' | 'CEO' | 'SYSTEM_ADMIN' | 'DIRECTOR';
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

      employee_profiles: LifecycleTable<
        {
          employee_id: number;
          date_of_birth: string | null;
          gender: string | null;
          blood_group: string | null;
          marital_status: string | null;
          father_name: string | null;
          current_address: string | null;
          permanent_address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relation: string | null;
          updated_at: string;
        },
        'employee_id',
        [EmployeeFk<'employee_profiles_employee_id_fkey', 'employee_id'>]
      >;
      employee_financials: LifecycleTable<
        {
          employee_id: number;
          pan_number: string | null;
          aadhaar_number: string | null;
          aadhaar_last4: string | null;
          uan_number: string | null;
          esic_number: string | null;
          bank_name: string | null;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          updated_at: string;
        },
        'employee_id',
        [EmployeeFk<'employee_financials_employee_id_fkey', 'employee_id'>]
      >;
      assets: LifecycleTable<
        {
          id: number;
          asset_tag: string;
          category: 'LAPTOP' | 'DESKTOP' | 'MOBILE' | 'SIM' | 'TABLET' | 'MONITOR' | 'ACCESSORY' | 'ID_CARD' | 'OTHER';
          brand: string | null;
          model: string | null;
          serial_number: string | null;
          imei: string | null;
          phone_number: string | null;
          carrier: string | null;
          plan_details: string | null;
          specs: string | null;
          purchase_date: string | null;
          purchase_cost: number | null;
          vendor: string | null;
          warranty_until: string | null;
          status: 'IN_STOCK' | 'ASSIGNED' | 'IN_REPAIR' | 'RETIRED' | 'LOST';
          condition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED';
          assigned_to: number | null;
          assigned_at: string | null;
          acknowledged_at: string | null;
          notes: string | null;
          created_at: string;
        },
        'asset_tag' | 'category',
        [EmployeeFk<'assets_assigned_to_fkey', 'assigned_to'>]
      >;
      asset_assignments: LifecycleTable<
        {
          id: number;
          asset_id: number;
          employee_id: number;
          assigned_at: string;
          assigned_by: number | null;
          returned_at: string | null;
          return_condition: 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | null;
          notes: string | null;
        },
        'asset_id' | 'employee_id',
        [
          EmployeeFk<'asset_assignments_employee_id_fkey', 'employee_id'>,
          EmployeeFk<'asset_assignments_assigned_by_fkey', 'assigned_by'>,
          {
            foreignKeyName: 'asset_assignments_asset_id_fkey';
            columns: ['asset_id'];
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          }
        ]
      >;
      it_requests: LifecycleTable<
        {
          id: number;
          employee_id: number;
          request_type: 'ONBOARDING' | 'OFFBOARDING' | 'NEW_ASSET' | 'REPAIR' | 'ACCESS' | 'OTHER';
          title: string;
          details: string | null;
          priority: 'LOW' | 'MEDIUM' | 'HIGH';
          status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
          raised_by: number | null;
          resolution: string | null;
          created_at: string;
          closed_at: string | null;
        },
        'employee_id' | 'request_type' | 'title',
        [
          EmployeeFk<'it_requests_employee_id_fkey', 'employee_id'>,
          EmployeeFk<'it_requests_raised_by_fkey', 'raised_by'>
        ]
      >;
      lifecycle_tasks: LifecycleTable<
        {
          id: number;
          employee_id: number;
          kind: 'ONBOARDING' | 'OFFBOARDING';
          owner_role: 'HR' | 'IT' | 'ACCOUNTS' | 'MANAGER';
          title: string;
          due_date: string | null;
          done: boolean;
          done_by: number | null;
          done_at: string | null;
          created_at: string;
        },
        'employee_id' | 'kind' | 'owner_role' | 'title',
        [
          EmployeeFk<'lifecycle_tasks_employee_id_fkey', 'employee_id'>,
          EmployeeFk<'lifecycle_tasks_done_by_fkey', 'done_by'>
        ]
      >;
      salary_revisions: LifecycleTable<
        {
          id: number;
          employee_id: number;
          revision_type: 'JOINING' | 'INCREMENT' | 'PROMOTION' | 'CORRECTION';
          effective_from: string;
          ctc_annual: number;
          basic_monthly: number;
          hra_monthly: number;
          special_monthly: number;
          other_allowance_monthly: number;
          tds_monthly: number;
          pf_applicable: boolean;
          pay_type: 'MONTHLY' | 'DAILY';
          daily_rate: number | null;
          increment_pct: number | null;
          new_designation: string | null;
          reason: string | null;
          status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
          proposed_by: number | null;
          approved_by: number | null;
          approved_at: string | null;
          created_at: string;
        },
        'employee_id' | 'revision_type' | 'effective_from' | 'ctc_annual' | 'basic_monthly',
        [
          EmployeeFk<'salary_revisions_employee_id_fkey', 'employee_id'>,
          EmployeeFk<'salary_revisions_proposed_by_fkey', 'proposed_by'>,
          EmployeeFk<'salary_revisions_approved_by_fkey', 'approved_by'>
        ]
      >;
      payroll_entries: LifecycleTable<
        {
          id: number;
          employee_id: number;
          year: number;
          month: number;
          calendar_days: number;
          payable_days: number;
          present_days: number;
          paid_leave_days: number;
          holiday_days: number;
          week_off_days: number;
          lop_days: number;
          late_marks: number;
          earnings: Json;
          deductions: Json;
          employer_contributions: Json;
          gross_earnings: number;
          total_deductions: number;
          net_pay: number;
          pay_type: 'MONTHLY' | 'DAILY';
          worked_hours: number | null;
          daily_rate: number | null;
          status: 'DRAFT' | 'APPROVED' | 'PUBLISHED';
          revision_id: number | null;
          computed_by: number | null;
          computed_at: string;
          published_at: string | null;
        },
        'employee_id' | 'year' | 'month',
        [
          EmployeeFk<'payroll_entries_employee_id_fkey', 'employee_id'>,
          EmployeeFk<'payroll_entries_computed_by_fkey', 'computed_by'>
        ]
      >;
      holiday_work_claims: LifecycleTable<
        {
          id: number;
          employee_id: number;
          work_date: string;
          worked_hours: number | null;
          days: number;
          compensation: 'COMP_OFF' | 'OVERTIME';
          reason: string | null;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          approver_id: number | null;
          approver_remarks: string | null;
          acted_at: string | null;
          created_at: string;
        },
        'employee_id' | 'work_date' | 'days' | 'compensation',
        [
          EmployeeFk<'holiday_work_claims_employee_id_fkey', 'employee_id'>,
          EmployeeFk<'holiday_work_claims_approver_id_fkey', 'approver_id'>
        ]
      >;
      branches: LifecycleTable<
        {
          id: number;
          name: string;
          code: string;
          address: string | null;
          city: string | null;
          state: string | null;
          latitude: number;
          longitude: number;
          geofence_radius_m: number;
          active: boolean;
          admin_employee_ids: number[];
          created_at: string;
          updated_at: string;
        },
        'name' | 'code'
      >;
      wfh_requests: LifecycleTable<
        {
          id: number;
          employee_id: number;
          from_date: string;
          to_date: string;
          reason: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
          approver_id: number | null;
          approved_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        'employee_id' | 'from_date' | 'to_date' | 'reason',
        [EmployeeFk<'wfh_requests_employee_id_fkey', 'employee_id'>]
      >;
      email_outbox: LifecycleTable<
        {
          id: number;
          template: string;
          to: string;
          cc: string | null;
          subject: string;
          payload: Record<string, any>;
          status: 'PENDING' | 'SENT' | 'FAILED';
          attempts: number;
          last_error: string | null;
          dedupe_key: string | null;
          created_at: string;
          sent_at: string | null;
        },
        'template' | 'to' | 'subject'
      >;
      employee_history: LifecycleTable<
        {
          id: number;
          employee_id: number;
          field: string;
          old_value: string | null;
          new_value: string | null;
          changed_by: number | null;
          changed_at: string;
        },
        'employee_id' | 'field',
        [EmployeeFk<'employee_history_employee_id_fkey', 'employee_id'>]
      >;
      employee_documents: LifecycleTable<
        {
          id: number;
          employee_id: number;
          category: string;
          file_path: string;
          name: string;
          size: number;
          uploaded_by: number | null;
          uploaded_at: string;
        },
        'employee_id' | 'category' | 'file_path' | 'name',
        [EmployeeFk<'employee_documents_employee_id_fkey', 'employee_id'>]
      >;
      profile_change_requests: LifecycleTable<
        {
          id: number;
          employee_id: number;
          field: string;
          old_value: string | null;
          new_value: string;
          reason: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          actioned_by: number | null;
          actioned_at: string | null;
          rejection_reason: string | null;
          created_at: string;
        },
        'employee_id' | 'field' | 'new_value' | 'reason',
        [EmployeeFk<'profile_change_requests_employee_id_fkey', 'employee_id'>]
      >;
      resignations: LifecycleTable<
        {
          id: number;
          employee_id: number;
          submitted_date: string;
          reason: string;
          requested_lwd: string;
          confirmed_lwd: string | null;
          notice_days: number;
          status: 'SUBMITTED' | 'ACCEPTED_BY_MANAGER' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
          manager_comments: string | null;
          hr_comments: string | null;
          actioned_by_manager_at: string | null;
          actioned_by_hr_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'employee_id' | 'reason' | 'requested_lwd',
        [EmployeeFk<'resignations_employee_id_fkey', 'employee_id'>]
      >;
      fnf_settlements: LifecycleTable<
        {
          id: number;
          resignation_id: number | null;
          employee_id: number;
          status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
          last_working_day: string;
          payable_days: number;
          per_day_basic: number;
          salary_due: number;
          leave_encashment_days: number;
          leave_encashment_amount: number;
          gratuity_amount: number;
          bonus_amount: number;
          notice_shortfall_days: number;
          notice_recovery_amount: number;
          asset_recovery_amount: number;
          other_recoveries: number;
          other_payables: number;
          net_payable: number;
          remarks: string | null;
          prepared_by: number | null;
          prepared_at: string | null;
          approved_by: number | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'employee_id' | 'last_working_day',
        [EmployeeFk<'fnf_settlements_employee_id_fkey', 'employee_id'>]
      >;
      gallery_albums: LifecycleTable<
        {
          id: number;
          branch_id: number | null;
          title: string;
          event_type: 'FESTIVAL' | 'BIRTHDAY' | 'OTHER';
          event_date: string;
          description: string | null;
          created_by: number | null;
          created_at: string;
        },
        'title' | 'event_type'
      >;
      gallery_photos: LifecycleTable<
        {
          id: number;
          album_id: number;
          file_path: string;
          caption: string | null;
          uploaded_by: number | null;
          uploaded_at: string;
        },
        'album_id' | 'file_path'
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
