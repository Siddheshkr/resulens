export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      clerk_webhook_events: {
        Row: {
          event_id: string;
          event_type: string;
          processed_at: string | null;
          received_at: string;
        };
        Insert: {
          event_id: string;
          event_type: string;
          processed_at?: string | null;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          processed_at?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          normalized_name: string;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          normalized_name: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          normalized_name?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      ingestion_runs: {
        Row: {
          completed_at: string | null;
          error_code: string | null;
          error_message: string | null;
          id: string;
          is_complete: boolean;
          pages_fetched: number;
          rate_limit_count: number;
          records_failed: number;
          records_seen: number;
          records_upserted: number;
          retry_count: number;
          source_id: string;
          started_at: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          is_complete?: boolean;
          pages_fetched?: number;
          rate_limit_count?: number;
          records_failed?: number;
          records_seen?: number;
          records_upserted?: number;
          retry_count?: number;
          source_id: string;
          started_at?: string;
          status?: string;
        };
        Update: {
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          is_complete?: boolean;
          pages_fetched?: number;
          rate_limit_count?: number;
          records_failed?: number;
          records_seen?: number;
          records_upserted?: number;
          retry_count?: number;
          source_id?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "job_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      job_postings: {
        Row: {
          canonical_url: string;
          company_id: string | null;
          content_fingerprint: string;
          country_code: string | null;
          created_at: string;
          description: string;
          employment_type: string | null;
          expires_at: string | null;
          external_job_id: string;
          id: string;
          last_seen_at: string;
          location_text: string | null;
          posted_at: string | null;
          search_document: unknown;
          seniority: string | null;
          source_id: string;
          source_updated_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          workplace_type: string;
        };
        Insert: {
          canonical_url: string;
          company_id?: string | null;
          content_fingerprint: string;
          country_code?: string | null;
          created_at?: string;
          description: string;
          employment_type?: string | null;
          expires_at?: string | null;
          external_job_id: string;
          id?: string;
          last_seen_at?: string;
          location_text?: string | null;
          posted_at?: string | null;
          search_document?: unknown;
          seniority?: string | null;
          source_id: string;
          source_updated_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          workplace_type?: string;
        };
        Update: {
          canonical_url?: string;
          company_id?: string | null;
          content_fingerprint?: string;
          country_code?: string | null;
          created_at?: string;
          description?: string;
          employment_type?: string | null;
          expires_at?: string | null;
          external_job_id?: string;
          id?: string;
          last_seen_at?: string;
          location_text?: string | null;
          posted_at?: string | null;
          search_document?: unknown;
          seniority?: string | null;
          source_id?: string;
          source_updated_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          workplace_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_postings_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_postings_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "job_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      job_skills: {
        Row: {
          created_at: string;
          display_skill: string;
          id: string;
          job_posting_id: string;
          normalized_skill: string;
          source: string;
        };
        Insert: {
          created_at?: string;
          display_skill: string;
          id?: string;
          job_posting_id: string;
          normalized_skill: string;
          source?: string;
        };
        Update: {
          created_at?: string;
          display_skill?: string;
          id?: string;
          job_posting_id?: string;
          normalized_skill?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_skills_job_posting_id_fkey";
            columns: ["job_posting_id"];
            isOneToOne: false;
            referencedRelation: "job_postings";
            referencedColumns: ["id"];
          },
        ];
      };
      job_sources: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          last_attempted_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          last_succeeded_at: string | null;
          provider: string;
          provider_config: Json;
          refresh_interval_minutes: number;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          last_attempted_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          last_succeeded_at?: string | null;
          provider: string;
          provider_config?: Json;
          refresh_interval_minutes?: number;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          last_attempted_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          last_succeeded_at?: string | null;
          provider?: string;
          provider_config?: Json;
          refresh_interval_minutes?: number;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      resume_processing_jobs: {
        Row: {
          attempt_count: number;
          available_at: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          input_tokens: number | null;
          kind: string;
          last_error_code: string | null;
          last_error_message: string | null;
          latency_ms: number | null;
          locked_at: string | null;
          locked_by: string | null;
          output_tokens: number | null;
          provider_model: string | null;
          resume_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          attempt_count?: number;
          available_at?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          kind?: string;
          last_error_code?: string | null;
          last_error_message?: string | null;
          latency_ms?: number | null;
          locked_at?: string | null;
          locked_by?: string | null;
          output_tokens?: number | null;
          provider_model?: string | null;
          resume_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          attempt_count?: number;
          available_at?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          input_tokens?: number | null;
          kind?: string;
          last_error_code?: string | null;
          last_error_message?: string | null;
          latency_ms?: number | null;
          locked_at?: string | null;
          locked_by?: string | null;
          output_tokens?: number | null;
          provider_model?: string | null;
          resume_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resume_processing_jobs_resume_id_user_id_fkey";
            columns: ["resume_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "resumes";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "resume_processing_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      resume_profiles: {
        Row: {
          approved_at: string | null;
          average_confidence: number | null;
          created_at: string;
          id: string;
          model: string | null;
          profile: Json;
          prompt_version: string;
          resume_id: string;
          schema_version: string;
          source_mode: string;
          status: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          average_confidence?: number | null;
          created_at?: string;
          id?: string;
          model?: string | null;
          profile: Json;
          prompt_version: string;
          resume_id: string;
          schema_version: string;
          source_mode: string;
          status: string;
          updated_at?: string;
          user_id: string;
          version: number;
        };
        Update: {
          approved_at?: string | null;
          average_confidence?: number | null;
          created_at?: string;
          id?: string;
          model?: string | null;
          profile?: Json;
          prompt_version?: string;
          resume_id?: string;
          schema_version?: string;
          source_mode?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "resume_profiles_resume_id_user_id_fkey";
            columns: ["resume_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "resumes";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "resume_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      resumes: {
        Row: {
          ai_processing_consent_at: string;
          approved_profile_version: number | null;
          byte_size: number;
          created_at: string;
          deleted_at: string | null;
          derived_profile_version: number | null;
          error_code: string | null;
          error_message: string | null;
          extracted_character_count: number | null;
          id: string;
          latest_profile_version: number | null;
          mime_type: string;
          next_retry_at: string | null;
          original_filename: string;
          page_count: number | null;
          processing_stage: string;
          retry_count: number;
          status: string;
          storage_path: string;
          updated_at: string;
          upload_completed_at: string | null;
          user_id: string;
        };
        Insert: {
          ai_processing_consent_at: string;
          approved_profile_version?: number | null;
          byte_size: number;
          created_at?: string;
          deleted_at?: string | null;
          derived_profile_version?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          extracted_character_count?: number | null;
          id?: string;
          latest_profile_version?: number | null;
          mime_type?: string;
          next_retry_at?: string | null;
          original_filename: string;
          page_count?: number | null;
          processing_stage?: string;
          retry_count?: number;
          status?: string;
          storage_path: string;
          updated_at?: string;
          upload_completed_at?: string | null;
          user_id: string;
        };
        Update: {
          ai_processing_consent_at?: string;
          approved_profile_version?: number | null;
          byte_size?: number;
          created_at?: string;
          deleted_at?: string | null;
          derived_profile_version?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          extracted_character_count?: number | null;
          id?: string;
          latest_profile_version?: number | null;
          mime_type?: string;
          next_retry_at?: string | null;
          original_filename?: string;
          page_count?: number | null;
          processing_stage?: string;
          retry_count?: number;
          status?: string;
          storage_path?: string;
          updated_at?: string;
          upload_completed_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resumes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ack_resume_processing: {
        Args: { p_message_id: number };
        Returns: boolean;
      };
      enqueue_resume_processing: {
        Args: {
          p_delay_seconds?: number;
          p_job_id: string;
          p_resume_id: string;
        };
        Returns: number;
      };
      read_resume_processing: {
        Args: { p_limit?: number; p_visibility_timeout?: number };
        Returns: Json;
      };
      upsert_job_posting_payload: {
        Args: {
          p_content_fingerprint: string;
          p_job_posting_id: string;
          p_payload: Json;
          p_source_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
