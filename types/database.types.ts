export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      chat_room_notification_preferences: {
        Row: {
          created_at: string;
          email_muted: boolean;
          id: string;
          profile_id: string;
          room_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email_muted?: boolean;
          id?: string;
          profile_id: string;
          room_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email_muted?: boolean;
          id?: string;
          profile_id?: string;
          room_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_room_notification_preferences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_participant: {
        Row: {
          conversation_id: string;
          profile_id: string;
        };
        Insert: {
          conversation_id: string;
          profile_id: string;
        };
        Update: {
          conversation_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversationparticipant_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversationparticipant_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          admin_conversation: boolean;
          created_at: string | null;
          id: string;
        };
        Insert: {
          admin_conversation?: boolean;
          created_at?: string | null;
          id?: string;
        };
        Update: {
          admin_conversation?: boolean;
          created_at?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      Emails: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          message_id: string | null;
          recipient_id: string | null;
          session_id: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          message_id?: string | null;
          recipient_id?: string | null;
          session_id?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          message_id?: string | null;
          recipient_id?: string | null;
          session_id?: string | null;
        };
        Relationships: [];
      };
      Enrollments: {
        Row: {
          availability: Json | null;
          created_at: string;
          day: string | null;
          duration: number;
          end_date: string | null;
          end_time: string | null;
          frequency: Database["public"]["Enums"]["session_frequency"];
          id: string;
          meetingId: string | null;
          pairing_id: string | null;
          paused: boolean;
          start_date: string | null;
          start_time: string | null;
          student_id: string | null;
          summary: string | null;
          tutor_id: string | null;
        };
        Insert: {
          availability?: Json | null;
          created_at?: string;
          day?: string | null;
          duration: number;
          end_date?: string | null;
          end_time?: string | null;
          frequency?: Database["public"]["Enums"]["session_frequency"];
          id?: string;
          meetingId?: string | null;
          pairing_id?: string | null;
          paused?: boolean;
          start_date?: string | null;
          start_time?: string | null;
          student_id?: string | null;
          summary?: string | null;
          tutor_id?: string | null;
        };
        Update: {
          availability?: Json | null;
          created_at?: string;
          day?: string | null;
          duration?: number;
          end_date?: string | null;
          end_time?: string | null;
          frequency?: Database["public"]["Enums"]["session_frequency"];
          id?: string;
          meetingId?: string | null;
          pairing_id?: string | null;
          paused?: boolean;
          start_date?: string | null;
          start_time?: string | null;
          student_id?: string | null;
          summary?: string | null;
          tutor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "Enrollments_pairing_id_fkey";
            columns: ["pairing_id"];
            isOneToOne: false;
            referencedRelation: "Pairings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Enrollments_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      Events: {
        Row: {
          created_at: string;
          date: string | null;
          hours: number | null;
          id: string;
          summary: string | null;
          tutor_id: string | null;
          type: Database["public"]["Enums"]["event_type"];
        };
        Insert: {
          created_at?: string;
          date?: string | null;
          hours?: number | null;
          id?: string;
          summary?: string | null;
          tutor_id?: string | null;
          type?: Database["public"]["Enums"]["event_type"];
        };
        Update: {
          created_at?: string;
          date?: string | null;
          hours?: number | null;
          id?: string;
          summary?: string | null;
          tutor_id?: string | null;
          type?: Database["public"]["Enums"]["event_type"];
        };
        Relationships: [
          {
            foreignKeyName: "Events_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      Forms: {
        Row: {
          created_at: string;
          id: number;
          submitter: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          submitter?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          submitter?: string | null;
        };
        Relationships: [];
      };
      Meetings: {
        Row: {
          created_at: string;
          id: string;
          link: string;
          meeting_id: string;
          name: string;
          password: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          link: string;
          meeting_id: string;
          name: string;
          password?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          link?: string;
          meeting_id?: string;
          name?: string;
          password?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string | null;
          created_at: string;
          file: Json | null;
          id: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          file?: Json | null;
          id?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          file?: Json | null;
          id?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      Notifications: {
        Row: {
          created_at: string;
          id: string;
          previous_date: string | null;
          session_id: string | null;
          status: string | null;
          student_id: string | null;
          suggested_date: string | null;
          summary: string | null;
          tutor_id: string | null;
          type: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          previous_date?: string | null;
          session_id?: string | null;
          status?: string | null;
          student_id?: string | null;
          suggested_date?: string | null;
          summary?: string | null;
          tutor_id?: string | null;
          type?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          previous_date?: string | null;
          session_id?: string | null;
          status?: string | null;
          student_id?: string | null;
          suggested_date?: string | null;
          summary?: string | null;
          tutor_id?: string | null;
          type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "Notifications_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "Sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      pairing_logs: {
        Row: {
          created_at: string | null;
          error: boolean | null;
          id: string;
          message: string;
          metadata: Json | null;
          role: string | null;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          error?: boolean | null;
          id?: string;
          message: string;
          metadata?: Json | null;
          role?: string | null;
          type: string;
        };
        Update: {
          created_at?: string | null;
          error?: boolean | null;
          id?: string;
          message?: string;
          metadata?: Json | null;
          role?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      pairing_matches: {
        Row: {
          created_at: string;
          id: string;
          similarity: number | null;
          student_id: string;
          tutor_id: string;
          tutor_status: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          similarity?: number | null;
          student_id: string;
          tutor_id: string;
          tutor_status?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          similarity?: number | null;
          student_id?: string;
          tutor_id?: string;
          tutor_status?: string | null;
        };
        Relationships: [];
      };
      pairing_requests: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          priority: number;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          priority: number;
          status?: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          priority?: number;
          status?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pairing_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      Pairings: {
        Row: {
          created_at: string;
          id: string;
          student_id: string;
          tutor_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          student_id: string;
          tutor_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          student_id?: string;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pairings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pairings_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      Profiles: {
        Row: {
          age: string | null;
          ai_tutor_chatlogs: string | null;
          availability: Json[] | null;
          created_at: string;
          date_of_birth: string | null;
          email: string | null;
          first_name: string;
          gender: string | null;
          grade: string | null;
          id: string;
          languages_spoken: string[] | null;
          last_name: string;
          parent_email: string | null;
          parent_name: string | null;
          parent_phone: string | null;
          phone_number: string | null;
          role: string | null;
          settings_id: string;
          start_date: string | null;
          status: string | null;
          student_number: string | null;
          subject_embed: string | null;
          subjects_of_interest: string[] | null;
          timezone: string | null;
          tutor_ids: string[] | null;
          tutoring_hours: number | null;
          user_id: string | null;
        };
        Insert: {
          age?: string | null;
          ai_tutor_chatlogs?: string | null;
          availability?: Json[] | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          first_name: string;
          gender?: string | null;
          grade?: string | null;
          id?: string;
          languages_spoken?: string[] | null;
          last_name: string;
          parent_email?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          phone_number?: string | null;
          role?: string | null;
          settings_id: string;
          start_date?: string | null;
          status?: string | null;
          student_number?: string | null;
          subject_embed?: string | null;
          subjects_of_interest?: string[] | null;
          timezone?: string | null;
          tutor_ids?: string[] | null;
          tutoring_hours?: number | null;
          user_id?: string | null;
        };
        Update: {
          age?: string | null;
          ai_tutor_chatlogs?: string | null;
          availability?: Json[] | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          first_name?: string;
          gender?: string | null;
          grade?: string | null;
          id?: string;
          languages_spoken?: string[] | null;
          last_name?: string;
          parent_email?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          phone_number?: string | null;
          role?: string | null;
          settings_id?: string;
          start_date?: string | null;
          status?: string | null;
          student_number?: string | null;
          subject_embed?: string | null;
          subjects_of_interest?: string[] | null;
          timezone?: string | null;
          tutor_ids?: string[] | null;
          tutoring_hours?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "Profiles_settings_id_fkey";
            columns: ["settings_id"];
            isOneToOne: true;
            referencedRelation: "user_notification_settings";
            referencedColumns: ["id"];
          },
        ];
      };
      Requests: {
        Row: {
          created_at: string;
          id: string;
          request_information: Json | null;
          request_type: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          request_information?: Json | null;
          request_type?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          request_information?: Json | null;
          request_type?: string | null;
        };
        Relationships: [];
      };
      Sessions: {
        Row: {
          created_at: string;
          date: string | null;
          duration: number;
          enrollment_id: string | null;
          id: string;
          is_first_session: boolean;
          is_question_or_concern: boolean;
          meeting_id: string | null;
          session_exit_form: string | null;
          status: Database["public"]["Enums"]["session_status"] | null;
          student_id: string | null;
          summary: string | null;
          tutor_id: string | null;
        };
        Insert: {
          created_at?: string;
          date?: string | null;
          duration: number;
          enrollment_id?: string | null;
          id?: string;
          is_first_session?: boolean;
          is_question_or_concern?: boolean;
          meeting_id?: string | null;
          session_exit_form?: string | null;
          status?: Database["public"]["Enums"]["session_status"] | null;
          student_id?: string | null;
          summary?: string | null;
          tutor_id?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string | null;
          duration?: number;
          enrollment_id?: string | null;
          id?: string;
          is_first_session?: boolean;
          is_question_or_concern?: boolean;
          meeting_id?: string | null;
          session_exit_form?: string | null;
          status?: Database["public"]["Enums"]["session_status"] | null;
          student_id?: string | null;
          summary?: string | null;
          tutor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "Sessions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "Enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Sessions_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "Meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Sessions_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      User_Availabilities: {
        Row: {
          created_at: string;
          day_of_the_week: number | null;
          end_time: string | null;
          id: number;
          profile_id: string | null;
          start_time: string | null;
          timezone: Database["public"]["Enums"]["timezone"] | null;
        };
        Insert: {
          created_at?: string;
          day_of_the_week?: number | null;
          end_time?: string | null;
          id?: number;
          profile_id?: string | null;
          start_time?: string | null;
          timezone?: Database["public"]["Enums"]["timezone"] | null;
        };
        Update: {
          created_at?: string;
          day_of_the_week?: number | null;
          end_time?: string | null;
          id?: number;
          profile_id?: string | null;
          start_time?: string | null;
          timezone?: Database["public"]["Enums"]["timezone"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "User_Availabilities_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notification_settings: {
        Row: {
          created_at: string;
          email_tutoring_session_notifications_enabled: boolean;
          email_webinar_notifications_enabled: boolean;
          id: string;
          text_tutoring_session_notifications_enabled: boolean;
          text_webinar_notifications_enabled: boolean;
        };
        Insert: {
          created_at?: string;
          email_tutoring_session_notifications_enabled?: boolean;
          email_webinar_notifications_enabled?: boolean;
          id?: string;
          text_tutoring_session_notifications_enabled?: boolean;
          text_webinar_notifications_enabled?: boolean;
        };
        Update: {
          created_at?: string;
          email_tutoring_session_notifications_enabled?: boolean;
          email_webinar_notifications_enabled?: boolean;
          id?: string;
          text_tutoring_session_notifications_enabled?: boolean;
          text_webinar_notifications_enabled?: boolean;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          created_at: string;
          email: string | null;
          last_active_profile_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          last_active_profile_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          last_active_profile_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_last_active_profile_id_fkey";
            columns: ["last_active_profile_id"];
            isOneToOne: true;
            referencedRelation: "Profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      zoom_participant_events: {
        Row: {
          action: string;
          email: string | null;
          id: string;
          name: string;
          participant_id: string;
          session_id: string | null;
          timestamp: string;
        };
        Insert: {
          action: string;
          email?: string | null;
          id?: string;
          name: string;
          participant_id: string;
          session_id?: string | null;
          timestamp?: string;
        };
        Update: {
          action?: string;
          email?: string | null;
          id?: string;
          name?: string;
          participant_id?: string;
          session_id?: string | null;
          timestamp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "zoom_participant_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "Sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      availability_overlap: {
        Args: { slots1: Json; slots2: Json };
        Returns: boolean;
      };
      availability_to_slots: {
        Args: { availabilities: Json[]; tz: string };
        Returns: {
          day: string;
          end_ts: string;
          start_ts: string;
        }[];
      };
      get_admin_conversations: {
        Args: never;
        Returns: {
          conversation_id: string;
          created_at: string;
          participants: Json;
        }[];
      };
      get_all_event_details_for_tutor: {
        Args: { p_tutor_id: string };
        Returns: Json;
      };
      get_all_event_hours: { Args: { input_user_id: string }; Returns: number };
      get_all_event_hours_batch: { Args: never; Returns: Json };
      get_all_event_hours_batch_with_type: {
        Args: { event_type: string };
        Returns: Json;
      };
      get_all_hours_batch: { Args: never; Returns: Json };
      get_all_pairing_requests: {
        Args: { p_type: string };
        Returns: {
          created_at: string;
          priority: number;
          profile: Json;
          request_id: string;
          status: string;
          type: string;
          user_id: string;
        }[];
      };
      get_all_session_hours: {
        Args: { input_user_id: string };
        Returns: number;
      };
      get_all_session_hours_batch: { Args: never; Returns: Json };
      get_all_session_hours_with_student: {
        Args: { input_student_id: string; input_tutor_id: string };
        Returns: number;
      };
      get_best_match: {
        Args: { request_id: string; request_type: string };
        Returns: {
          match_profile: Json;
          pairing_request_id: string;
          requestor_profile: Json;
          similarity: number;
        }[];
      };
      get_best_pairing_match: {
        Args: {
          availability: Json;
          embedding: string;
          profile_id: string;
          request_id: string;
          request_type: string;
        };
        Returns: {
          matched_profile_id: string;
          pairing_request_id: string;
          similarity: number;
        }[];
      };
      get_client_admin_conversations: {
        Args: { profile_id: string };
        Returns: {
          conversation_id: string;
          participants: Json;
        }[];
      };
      get_enrollment_with_profiles: {
        Args: { enrollment_uuid: string };
        Returns: {
          availability: Json;
          created_at: string;
          duration: number;
          end_date: string;
          id: string;
          meetingid: string;
          start_date: string;
          student: Json;
          student_id: string;
          summary: string;
          summer_paused: boolean;
          tutor: Json;
          tutor_id: string;
        }[];
      };
      get_enrollments_with_student_profile: {
        Args: never;
        Returns: {
          availability: Json;
          created_at: string;
          duration: number;
          email: string;
          end_date: string;
          first_name: string;
          id: string;
          last_name: string;
          meetingid: string;
          profile_id: string;
          profile_user_id: string;
          start_date: string;
          student_id: string;
          summary: string;
          summer_paused: boolean;
          tutor_id: string;
        }[];
      };
      get_event_hours_range: {
        Args: {
          input_end_date: string;
          input_start_date: string;
          input_user_id: string;
        };
        Returns: number;
      };
      get_event_hours_range_batch: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_first_overlapping_availability: {
        Args: { a: Json[]; b: Json[] };
        Returns: Json;
      };
      get_first_pairing_availability: {
        Args: { pairing_id: string };
        Returns: Json;
      };
      get_hours_range_batch: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_overlapping_availabilities_array: {
        Args: { a: Json[]; b: Json[] };
        Returns: Json;
      };
      get_pairing_logs: {
        Args: { end_time: string; start_time: string };
        Returns: {
          created_at: string;
          id: string;
          match_profile: Json;
          message: string;
          profile: Json;
          status: string;
          type: string;
        }[];
      };
      get_pairing_match: {
        Args: { match_id: string };
        Returns: {
          created_at: string;
          pairing_match_id: string;
          student: Json;
          student_id: string;
          tutor: Json;
          tutor_id: string;
        }[];
      };
      get_pairing_matches_with_profiles: {
        Args: { requestor: string };
        Returns: {
          created_at: string;
          pairing_match_id: string;
          student: Json;
          student_id: string;
          tutor: Json;
          tutor_id: string;
        }[];
      };
      get_pairing_requests_with_profiles: {
        Args: { requestor: string };
        Returns: {
          created_at: string;
          pairing_request_id: string;
          status: string;
          student: Json;
          student_id: string;
          tutor: Json;
          tutor_id: string;
          updated_at: string;
        }[];
      };
      get_pairing_with_profiles: {
        Args: { pairing_uuid: string };
        Returns: {
          created_at: string;
          id: string;
          student: Json;
          student_id: string;
          tutor: Json;
          tutor_id: string;
        }[];
      };
      get_session_hours_by_student: {
        Args: { p_tutor_id: string };
        Returns: Json;
      };
      get_session_hours_range: {
        Args: {
          input_end_date: string;
          input_start_date: string;
          input_tutor_id: string;
        };
        Returns: number;
      };
      get_session_hours_range_batch: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_session_hours_range_with_student: {
        Args: {
          input_end_date: string;
          input_start_date: string;
          input_student_id: string;
          input_tutor_id: string;
        };
        Returns: number;
      };
      get_top_pairing_request: {
        Args: { request_type: string };
        Returns: {
          embedding: string;
          pairing_request_id: string;
          profile_id: string;
        }[];
      };
      get_total_event_hours_range: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_total_hours: { Args: never; Returns: number };
      get_total_hours_range: {
        Args: { end_date: string; start_date: string };
        Returns: number;
      };
      get_total_session_hours_range: {
        Args: { end_date: string; start_date: string };
        Returns: number;
      };
      get_tutor_sessions: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          first_name: string;
          last_name: string;
          session_dates: Json;
          total_sessions: number;
          tutor_id: string;
        }[];
      };
      get_tutor_sessions_with_date: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          first_name: string;
          last_name: string;
          total_sessions: number;
          tutor_id: string;
        }[];
      };
      get_user_enrollments: {
        Args: { input_user_id: string };
        Returns: {
          availability: Json;
          created_at: string;
          duration: number;
          end_date: string;
          id: string;
          meetingId: string;
          profile_email: string;
          profile_id: string;
          profile_name: string;
          profile_user_id: string;
          start_date: string;
          student_id: string;
          summary: string;
          summer_paused: boolean;
          tutor_id: string;
        }[];
      };
      get_user_enrollments_with_profiles: {
        Args: { requestor_auth_id: string };
        Returns: {
          availability: Json;
          created_at: string;
          duration: number;
          end_date: string;
          id: string;
          meetingid: string;
          start_date: string;
          student: Json;
          summary: string;
          summer_paused: boolean;
          tutor: Json;
        }[];
      };
      get_user_enrollments_with_student_profile: {
        Args: { requestor_auth_id: string };
        Returns: {
          availability: Json;
          created_at: string;
          duration: number;
          end_date: string;
          id: string;
          meetingid: string;
          start_date: string;
          student_email: string;
          student_first_name: string;
          student_id: string;
          student_last_name: string;
          student_profile_id: string;
          student_user_id: string;
          summary: string;
          summer_paused: boolean;
          tutor_id: string;
        }[];
      };
      get_user_pairings_with_profiles: {
        Args: { requestor_auth_id: string };
        Returns: {
          created_at: string;
          id: string;
          student: Json;
          student_id: string;
          tutor: Json;
          tutor_id: string;
        }[];
      };
      normalize_availability:
        | { Args: { avail: Json; tz: string }; Returns: Json }
        | { Args: { avail: Json[]; tz: string }; Returns: Json };
    };
    Enums: {
      day_of_the_week:
        | "sunday"
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday";
      event_type:
        | "Sub Hotline"
        | "Tutor Referral"
        | "Additional Tutoring Hours"
        | "School Tutoring"
        | "Biweekly Meeting"
        | "Other";
      pairing_status: "pending" | "accepted" | "rejected";
      session_frequency: "weekly" | "biweekly" | "monthly";
      session_status:
        | "Active"
        | "Complete"
        | "Cancelled"
        | "Rescheduled"
        | "Sub-Request"
        | "Expired";
      timezone: "EST" | "CST" | "PST" | "MST" | "MT" | "Other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      day_of_the_week: [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ],
      event_type: [
        "Sub Hotline",
        "Tutor Referral",
        "Additional Tutoring Hours",
        "School Tutoring",
        "Biweekly Meeting",
        "Other",
      ],
      pairing_status: ["pending", "accepted", "rejected"],
      session_frequency: ["weekly", "biweekly", "monthly"],
      session_status: [
        "Active",
        "Complete",
        "Cancelled",
        "Rescheduled",
        "Sub-Request",
        "Expired",
      ],
      timezone: ["EST", "CST", "PST", "MST", "MT", "Other"],
    },
  },
} as const;
