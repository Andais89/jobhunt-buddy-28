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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          agency: string | null
          applied_at: string
          archived_at: string | null
          benefits: string | null
          company: string | null
          contact_email: string | null
          contract_type: string | null
          created_at: string
          follow_up_at: string | null
          follow_up_days: number
          gap_analysis: Json | null
          hours_week: string | null
          id: string
          interview_questions: string | null
          interviewer_linkedin: string | null
          interviewer_name: string | null
          job_summary: string | null
          job_url: string | null
          location: string | null
          match_score: number | null
          notes: string | null
          priority: Database["public"]["Enums"]["application_priority"]
          role: string
          salary: string | null
          salary_amount: number | null
          salary_period: string | null
          seniority_level: string | null
          source: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
          work_mode: string | null
        }
        Insert: {
          agency?: string | null
          applied_at?: string
          archived_at?: string | null
          benefits?: string | null
          company?: string | null
          contact_email?: string | null
          contract_type?: string | null
          created_at?: string
          follow_up_at?: string | null
          follow_up_days?: number
          gap_analysis?: Json | null
          hours_week?: string | null
          id?: string
          interview_questions?: string | null
          interviewer_linkedin?: string | null
          interviewer_name?: string | null
          job_summary?: string | null
          job_url?: string | null
          location?: string | null
          match_score?: number | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["application_priority"]
          role: string
          salary?: string | null
          salary_amount?: number | null
          salary_period?: string | null
          seniority_level?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
          work_mode?: string | null
        }
        Update: {
          agency?: string | null
          applied_at?: string
          archived_at?: string | null
          benefits?: string | null
          company?: string | null
          contact_email?: string | null
          contract_type?: string | null
          created_at?: string
          follow_up_at?: string | null
          follow_up_days?: number
          gap_analysis?: Json | null
          hours_week?: string | null
          id?: string
          interview_questions?: string | null
          interviewer_linkedin?: string | null
          interviewer_name?: string | null
          job_summary?: string | null
          job_url?: string | null
          location?: string | null
          match_score?: number | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["application_priority"]
          role?: string
          salary?: string | null
          salary_amount?: number | null
          salary_period?: string | null
          seniority_level?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          end_date: string | null
          enrollment_date: string | null
          enrollment_deadline: string | null
          id: string
          name: string
          notes: string | null
          notify_days_before: number
          provider: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["course_status"]
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          enrollment_date?: string | null
          enrollment_deadline?: string | null
          id?: string
          name: string
          notes?: string | null
          notify_days_before?: number
          provider?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          enrollment_date?: string | null
          enrollment_deadline?: string | null
          id?: string
          name?: string
          notes?: string | null
          notify_days_before?: number
          provider?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          application_id: string | null
          company: string
          created_at: string
          id: string
          mode: string | null
          notify_days_before: number
          outcome: Database["public"]["Enums"]["interview_outcome"]
          prep_notes: string | null
          role: string | null
          scheduled_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          company: string
          created_at?: string
          id?: string
          mode?: string | null
          notify_days_before?: number
          outcome?: Database["public"]["Enums"]["interview_outcome"]
          prep_notes?: string | null
          role?: string | null
          scheduled_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          company?: string
          created_at?: string
          id?: string
          mode?: string | null
          notify_days_before?: number
          outcome?: Database["public"]["Enums"]["interview_outcome"]
          prep_notes?: string | null
          role?: string | null
          scheduled_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          cv_text: string | null
          display_name: string | null
          experience_summary: string | null
          id: string
          languages: string | null
          skills: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_text?: string | null
          display_name?: string | null
          experience_summary?: string | null
          id?: string
          languages?: string | null
          skills?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cv_text?: string | null
          display_name?: string | null
          experience_summary?: string | null
          id?: string
          languages?: string | null
          skills?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_priority: "bassa" | "media" | "alta"
      application_status:
        | "da_valutare"
        | "in_attesa"
        | "colloquio"
        | "positiva"
        | "negativa"
      course_status:
        | "interessato"
        | "iscritto"
        | "in_corso"
        | "completato"
        | "rifiutato"
      interview_outcome: "in_attesa" | "positivo" | "negativo" | "no_show"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      application_priority: ["bassa", "media", "alta"],
      application_status: [
        "da_valutare",
        "in_attesa",
        "colloquio",
        "positiva",
        "negativa",
      ],
      course_status: [
        "interessato",
        "iscritto",
        "in_corso",
        "completato",
        "rifiutato",
      ],
      interview_outcome: ["in_attesa", "positivo", "negativo", "no_show"],
    },
  },
} as const
