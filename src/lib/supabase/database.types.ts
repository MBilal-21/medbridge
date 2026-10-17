export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
          reason: string | null
          scheduled_at: string
          share_history: boolean
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
          reason?: string | null
          scheduled_at: string
          share_history?: boolean
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
          reason?: string | null
          scheduled_at?: string
          share_history?: boolean
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      check_flags: {
        Row: {
          ai_explanation: string | null
          check_id: string
          created_at: string
          finding: string
          id: string
          ingredient_rxcui: string | null
          medication_a_id: string
          medication_b_id: string | null
          severity: Database["public"]["Enums"]["flag_severity"]
          source: string
          type: Database["public"]["Enums"]["flag_type"]
        }
        Insert: {
          ai_explanation?: string | null
          check_id: string
          created_at?: string
          finding?: string
          id?: string
          ingredient_rxcui?: string | null
          medication_a_id: string
          medication_b_id?: string | null
          severity: Database["public"]["Enums"]["flag_severity"]
          source: string
          type: Database["public"]["Enums"]["flag_type"]
        }
        Update: {
          ai_explanation?: string | null
          check_id?: string
          created_at?: string
          finding?: string
          id?: string
          ingredient_rxcui?: string | null
          medication_a_id?: string
          medication_b_id?: string | null
          severity?: Database["public"]["Enums"]["flag_severity"]
          source?: string
          type?: Database["public"]["Enums"]["flag_type"]
        }
        Relationships: [
          {
            foreignKeyName: "check_flags_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_flags_ingredient_rxcui_fkey"
            columns: ["ingredient_rxcui"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["rxcui"]
          },
          {
            foreignKeyName: "check_flags_medication_a_id_fkey"
            columns: ["medication_a_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_flags_medication_a_id_fkey"
            columns: ["medication_a_id"]
            isOneToOne: false
            referencedRelation: "patient_medication_list"
            referencedColumns: ["medication_id"]
          },
          {
            foreignKeyName: "check_flags_medication_b_id_fkey"
            columns: ["medication_b_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_flags_medication_b_id_fkey"
            columns: ["medication_b_id"]
            isOneToOne: false
            referencedRelation: "patient_medication_list"
            referencedColumns: ["medication_id"]
          },
        ]
      }
      doctors: {
        Row: {
          clinic_name: string | null
          created_at: string
          license_number: string | null
          profile_id: string
          rejection_reason: string | null
          specialty: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          clinic_name?: string | null
          created_at?: string
          license_number?: string | null
          profile_id: string
          rejection_reason?: string | null
          specialty?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          clinic_name?: string | null
          created_at?: string
          license_number?: string | null
          profile_id?: string
          rejection_reason?: string | null
          specialty?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_reminders: {
        Row: {
          created_at: string
          due_at: string
          error: string | null
          id: string
          medication_ids: string[]
          patient_id: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          due_at: string
          error?: string | null
          id?: string
          medication_ids: string[]
          patient_id: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          due_at?: string
          error?: string | null
          id?: string
          medication_ids?: string[]
          patient_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dose_reminders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_interactions: {
        Row: {
          description: string
          ingredient_a: string
          ingredient_b: string
          severity: Database["public"]["Enums"]["flag_severity"]
          source: string
        }
        Insert: {
          description: string
          ingredient_a: string
          ingredient_b: string
          severity: Database["public"]["Enums"]["flag_severity"]
          source: string
        }
        Update: {
          description?: string
          ingredient_a?: string
          ingredient_b?: string
          severity?: Database["public"]["Enums"]["flag_severity"]
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_interactions_ingredient_a_fkey"
            columns: ["ingredient_a"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["rxcui"]
          },
          {
            foreignKeyName: "drug_interactions_ingredient_b_fkey"
            columns: ["ingredient_b"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["rxcui"]
          },
        ]
      }
      drug_products: {
        Row: {
          brand_name: string
          dose_form: string | null
          id: string
          rxcui: string | null
          strength: string | null
        }
        Insert: {
          brand_name: string
          dose_form?: string | null
          id?: string
          rxcui?: string | null
          strength?: string | null
        }
        Update: {
          brand_name?: string
          dose_form?: string | null
          id?: string
          rxcui?: string | null
          strength?: string | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          check_id: string | null
          id: string
          patient_id: string
          resend_id: string | null
          sent_at: string
          sent_to: string
        }
        Insert: {
          check_id?: string | null
          id?: string
          patient_id: string
          resend_id?: string | null
          sent_at?: string
          sent_to: string
        }
        Update: {
          check_id?: string | null
          id?: string
          patient_id?: string
          resend_id?: string | null
          sent_at?: string
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      history_shares: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "history_shares_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "history_shares_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          name: string
          rxcui: string
        }
        Insert: {
          name: string
          rxcui: string
        }
        Update: {
          name?: string
          rxcui?: string
        }
        Relationships: []
      }
      medication_decisions: {
        Row: {
          check_id: string
          decided_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["decision_type"]
          id: string
          medication_id: string
          note: string | null
        }
        Insert: {
          check_id: string
          decided_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["decision_type"]
          id?: string
          medication_id: string
          note?: string | null
        }
        Update: {
          check_id?: string
          decided_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["decision_type"]
          id?: string
          medication_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_decisions_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "medication_decisions_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_decisions_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "patient_medication_list"
            referencedColumns: ["medication_id"]
          },
        ]
      }
      medications: {
        Row: {
          ai_confidence: number | null
          created_at: string
          dose: string | null
          dose_times: string[]
          drug_product_id: string | null
          end_date: string | null
          frequency: string | null
          id: string
          instructions: string | null
          name_as_written: string
          patient_confirmed: boolean
          patient_id: string
          prescription_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["medication_status"]
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          dose?: string | null
          dose_times?: string[]
          drug_product_id?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          name_as_written: string
          patient_confirmed?: boolean
          patient_id: string
          prescription_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["medication_status"]
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          dose?: string | null
          dose_times?: string[]
          drug_product_id?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          name_as_written?: string
          patient_confirmed?: boolean
          patient_id?: string
          prescription_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["medication_status"]
        }
        Relationships: [
          {
            foreignKeyName: "medications_drug_product_id_fkey"
            columns: ["drug_product_id"]
            isOneToOne: false
            referencedRelation: "drug_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_uploads: {
        Row: {
          ai_raw_output: Json | null
          created_at: string
          error: string | null
          id: string
          patient_id: string
          status: Database["public"]["Enums"]["upload_status"]
          storage_path: string
        }
        Insert: {
          ai_raw_output?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          patient_id: string
          status?: Database["public"]["Enums"]["upload_status"]
          storage_path: string
        }
        Update: {
          ai_raw_output?: Json | null
          created_at?: string
          error?: string | null
          id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["upload_status"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_uploads_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          created_at: string
          doctor_id: string | null
          external_doctor_name: string | null
          id: string
          patient_id: string
          prescribed_on: string | null
          source: Database["public"]["Enums"]["prescription_source"]
          upload_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string | null
          external_doctor_name?: string | null
          id?: string
          patient_id: string
          prescribed_on?: string | null
          source: Database["public"]["Enums"]["prescription_source"]
          upload_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string | null
          external_doctor_name?: string | null
          id?: string
          patient_id?: string
          prescribed_on?: string | null
          source?: Database["public"]["Enums"]["prescription_source"]
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "prescription_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          ingredient_rxcui: string
          product_id: string
        }
        Insert: {
          ingredient_rxcui: string
          product_id: string
        }
        Update: {
          ingredient_rxcui?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_rxcui_fkey"
            columns: ["ingredient_rxcui"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["rxcui"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "drug_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          dose_reminders: boolean
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          dose_reminders?: boolean
          email: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          dose_reminders?: boolean
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reconciliation_checks: {
        Row: {
          appointment_id: string | null
          created_at: string
          doctor_id: string
          duration_ms: number | null
          id: string
          medications_checked: number
          new_prescription_id: string | null
          patient_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["check_status"]
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          doctor_id: string
          duration_ms?: number | null
          id?: string
          medications_checked?: number
          new_prescription_id?: string | null
          patient_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["check_status"]
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string
          duration_ms?: number | null
          id?: string
          medications_checked?: number
          new_prescription_id?: string | null
          patient_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["check_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_checks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_checks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "reconciliation_checks_new_prescription_id_fkey"
            columns: ["new_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_checks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      patient_medication_list: {
        Row: {
          brand_name: string | null
          decided_at: string | null
          decision: Database["public"]["Enums"]["decision_type"] | null
          decision_note: string | null
          dose: string | null
          dose_times: string[] | null
          frequency: string | null
          instructions: string | null
          medication_id: string | null
          name_as_written: string | null
          patient_id: string | null
          prescribed_by: string | null
          source: Database["public"]["Enums"]["prescription_source"] | null
          status: Database["public"]["Enums"]["medication_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      appointment_status: "requested" | "confirmed" | "completed" | "cancelled"
      check_status: "pending_review" | "reviewed"
      decision_type: "stop" | "continue" | "new" | "change"
      flag_severity: "low" | "moderate" | "high"
      flag_type: "duplicate" | "interaction" | "unclear"
      medication_status: "active" | "stopped" | "completed"
      prescription_source: "in_app" | "photo_upload"
      upload_status:
        | "uploaded"
        | "processing"
        | "needs_confirmation"
        | "confirmed"
        | "failed"
      user_role: "patient" | "doctor" | "admin"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["requested", "confirmed", "completed", "cancelled"],
      check_status: ["pending_review", "reviewed"],
      decision_type: ["stop", "continue", "new", "change"],
      flag_severity: ["low", "moderate", "high"],
      flag_type: ["duplicate", "interaction", "unclear"],
      medication_status: ["active", "stopped", "completed"],
      prescription_source: ["in_app", "photo_upload"],
      upload_status: [
        "uploaded",
        "processing",
        "needs_confirmation",
        "confirmed",
        "failed",
      ],
      user_role: ["patient", "doctor", "admin"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
