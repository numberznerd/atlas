/**
 * Typed schema for the Supabase client. Mirrors supabase/migrations/0001.
 * Regenerate from a live project any time with:
 *   supabase gen types typescript --project-id <id> > src/lib/types/database.ts
 */

export type UserRole = "admin" | "member" | "lite";
export type UserStatus = "active" | "invited" | "disabled";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type ResidencyTier = "managed" | "canada_only";
export type ClientType =
  | "individual"
  | "corporation"
  | "partnership"
  | "trust"
  | "nonprofit"
  | "other";
export type MeetingSource = "upload" | "recorder";
export type MeetingStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "summarizing"
  | "ready"
  | "failed";
export type ActionOwnerType = "firm" | "client";
export type ActionStatus = "open" | "done" | "dismissed";
export type DocumentType = "sop" | "transcript" | "summary" | "upload";
export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";
export type ChatScope = "client" | "firm";
export type ChatRole = "user" | "assistant" | "system";
export type ApprovalActionType = "email_draft" | "client_message" | "external_task";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Contact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface TranscriptSegment {
  speaker: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface SummaryPoint {
  text: string;
  ts?: number; // transcript timestamp (seconds) for source linking
}

export interface SummarySections {
  discussion_points?: SummaryPoint[];
  decisions?: SummaryPoint[];
  client_commitments?: SummaryPoint[];
  firm_commitments?: SummaryPoint[];
  risks?: SummaryPoint[];
  next_meeting?: SummaryPoint | null;
}

export interface Citation {
  document_id: string;
  title: string;
  snippet?: string;
  ts?: number;
}

type Timestamps = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      firms: {
        Row: {
          id: string;
          name: string;
          residency_tier: ResidencyTier;
          retention_months: number;
          privacy_contact: string | null;
        } & Timestamps;
        Insert: { id?: string; name: string; residency_tier?: ResidencyTier; retention_months?: number; privacy_contact?: string | null };
        Update: Partial<Database["public"]["Tables"]["firms"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          firm_id: string | null;
          email: string;
          full_name: string | null;
          role: UserRole | null;
          status: UserStatus;
        } & Timestamps;
        Insert: { id: string; firm_id?: string | null; email: string; full_name?: string | null; role?: UserRole | null; status?: UserStatus };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          firm_id: string;
          email: string;
          role: UserRole;
          status: InvitationStatus;
          invited_by: string | null;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: { id?: string; firm_id: string; email: string; role?: UserRole; status?: InvitationStatus; invited_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          firm_id: string;
          name: string;
          type: ClientType;
          engagement_types: string[];
          fiscal_year_end: string | null;
          contacts: Contact[];
          notes: string | null;
          ai_brief: string | null;
          ai_brief_updated_at: string | null;
          is_restricted: boolean;
          created_by: string | null;
        } & Timestamps;
        Insert: { id?: string; firm_id: string; name: string; type?: ClientType; engagement_types?: string[]; fiscal_year_end?: string | null; contacts?: Contact[]; notes?: string | null; ai_brief?: string | null; ai_brief_updated_at?: string | null; is_restricted?: boolean; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_assignments: {
        Row: { client_id: string; user_id: string; firm_id: string; created_at: string };
        Insert: { client_id: string; user_id: string; firm_id: string };
        Update: Partial<Database["public"]["Tables"]["client_assignments"]["Insert"]>;
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          firm_id: string;
          client_id: string | null;
          title: string;
          occurred_at: string | null;
          source: MeetingSource;
          status: MeetingStatus;
          consent_recorded: boolean;
          consent_note: string | null;
          audio_path: string | null;
          duration_seconds: number | null;
          language: string | null;
          created_by: string | null;
        } & Timestamps;
        Insert: { id?: string; firm_id: string; client_id?: string | null; title: string; occurred_at?: string | null; source?: MeetingSource; status?: MeetingStatus; consent_recorded?: boolean; consent_note?: string | null; audio_path?: string | null; duration_seconds?: number | null; language?: string | null; created_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Insert"]>;
        Relationships: [];
      };
      transcripts: {
        Row: {
          id: string;
          meeting_id: string;
          firm_id: string;
          segments: TranscriptSegment[];
          language: string | null;
          provider: string | null;
          word_count: number | null;
          created_at: string;
        };
        Insert: { id?: string; meeting_id: string; firm_id: string; segments?: TranscriptSegment[]; language?: string | null; provider?: string | null; word_count?: number | null };
        Update: Partial<Database["public"]["Tables"]["transcripts"]["Insert"]>;
        Relationships: [];
      };
      summaries: {
        Row: {
          id: string;
          meeting_id: string;
          firm_id: string;
          sections: SummarySections;
          finalized: boolean;
          model: string | null;
          edited_by: string | null;
        } & Timestamps;
        Insert: { id?: string; meeting_id: string; firm_id: string; sections?: SummarySections; finalized?: boolean; model?: string | null; edited_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["summaries"]["Insert"]>;
        Relationships: [];
      };
      action_items: {
        Row: {
          id: string;
          firm_id: string;
          client_id: string | null;
          meeting_id: string | null;
          owner_user_id: string | null;
          owner_type: ActionOwnerType;
          description: string;
          due_date: string | null;
          status: ActionStatus;
          source_ref: { meeting_id?: string; ts?: number } | null;
        } & Timestamps;
        Insert: { id?: string; firm_id: string; client_id?: string | null; meeting_id?: string | null; owner_user_id?: string | null; owner_type?: ActionOwnerType; description: string; due_date?: string | null; status?: ActionStatus; source_ref?: { meeting_id?: string; ts?: number } | null };
        Update: Partial<Database["public"]["Tables"]["action_items"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          firm_id: string;
          client_id: string | null;
          meeting_id: string | null;
          type: DocumentType;
          title: string;
          file_path: string | null;
          mime_type: string | null;
          status: DocumentStatus;
          uploaded_by: string | null;
        } & Timestamps;
        Insert: { id?: string; firm_id: string; client_id?: string | null; meeting_id?: string | null; type: DocumentType; title: string; file_path?: string | null; mime_type?: string | null; status?: DocumentStatus; uploaded_by?: string | null };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      chunks: {
        Row: {
          id: string;
          document_id: string;
          firm_id: string;
          client_id: string | null;
          content: string;
          chunk_index: number;
          token_count: number | null;
          embedding: string | null;
          created_at: string;
        };
        Insert: { id?: string; document_id: string; firm_id: string; client_id?: string | null; content: string; chunk_index?: number; token_count?: number | null; embedding?: number[] | null };
        Update: Partial<Database["public"]["Tables"]["chunks"]["Insert"]>;
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          id: string;
          firm_id: string;
          user_id: string;
          client_id: string | null;
          scope: ChatScope;
          title: string;
        } & Timestamps;
        Insert: { id?: string; firm_id: string; user_id: string; client_id?: string | null; scope?: ChatScope; title?: string };
        Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          firm_id: string;
          role: ChatRole;
          content: string;
          citations: Citation[];
          created_at: string;
        };
        Insert: { id?: string; session_id: string; firm_id: string; role: ChatRole; content: string; citations?: Citation[] };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      approval_queue: {
        Row: {
          id: string;
          firm_id: string;
          action_type: ApprovalActionType;
          draft_content: { subject?: string; body: string; recipient?: string };
          related_client_id: string | null;
          related_meeting_id: string | null;
          status: ApprovalStatus;
          created_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
        } & Timestamps;
        Insert: { id?: string; firm_id: string; action_type: ApprovalActionType; draft_content: { subject?: string; body: string; recipient?: string }; related_client_id?: string | null; related_meeting_id?: string | null; status?: ApprovalStatus; created_by?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null };
        Update: Partial<Database["public"]["Tables"]["approval_queue"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          firm_id: string | null;
          actor_user_id: string | null;
          event_type: string;
          target_type: string | null;
          target_id: string | null;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: { id?: string; firm_id?: string | null; actor_user_id?: string | null; event_type: string; target_type?: string | null; target_id?: string | null; payload?: Record<string, unknown> };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_firm: {
        Args: { p_name: string; p_residency_tier?: ResidencyTier };
        Returns: string;
      };
      log_audit_event: {
        Args: { p_event_type: string; p_target_type?: string | null; p_target_id?: string | null; p_payload?: Record<string, unknown> };
        Returns: undefined;
      };
      keyword_search: {
        Args: { query_text: string; p_client_id?: string | null; match_limit?: number };
        Returns: SearchResult[];
      };
      hybrid_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          p_client_id?: string | null;
          match_limit?: number;
          full_text_weight?: number;
          semantic_weight?: number;
          rrf_k?: number;
        };
        Returns: SearchResult[];
      };
    };
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      residency_tier: ResidencyTier;
      client_type: ClientType;
      meeting_status: MeetingStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export interface SearchResult {
  id: string;
  document_id: string;
  document_title: string;
  document_type: DocumentType;
  client_id: string | null;
  content: string;
  score: number;
}

// Convenience row aliases used across the app.
export type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type AppUser = Database["public"]["Tables"]["users"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
export type Transcript = Database["public"]["Tables"]["transcripts"]["Row"];
export type Summary = Database["public"]["Tables"]["summaries"]["Row"];
export type ActionItem = Database["public"]["Tables"]["action_items"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type ChatSession = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
export type Approval = Database["public"]["Tables"]["approval_queue"]["Row"];
export type AuditEntry = Database["public"]["Tables"]["audit_log"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
