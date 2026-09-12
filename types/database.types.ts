export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
      discord_chatbot_conversations: {
        Row: {
          created_at: string;
          discord_channel_id: string | null;
          discord_user_id: string | null;
          id: string;
          prompt: string | null;
          response: string | null;
        };
        Insert: {
          created_at?: string;
          discord_channel_id?: string | null;
          discord_user_id?: string | null;
          id?: string;
          prompt?: string | null;
          response?: string | null;
        };
        Update: {
          created_at?: string;
          discord_channel_id?: string | null;
          discord_user_id?: string | null;
          id?: string;
          prompt?: string | null;
          response?: string | null;
        };
        Relationships: [];
      };
      emails: {
        Row: {
          content: string | null;
          created_at: string;
          id: string;
          recipient_email: string;
          subject: string | null;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          id?: string;
          recipient_email: string;
          subject?: string | null;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          id?: string;
          recipient_email?: string;
          subject?: string | null;
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
          inactivity_warning_sent_at: string | null;
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
          inactivity_warning_sent_at?: string | null;
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
          inactivity_warning_sent_at?: string | null;
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
            foreignKeyName: "Enrollments_meetingId_fkey";
            columns: ["meetingId"];
            isOneToOne: false;
            referencedRelation: "Meetings";
            referencedColumns: ["id"];
          },
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
          rejected_at: string | null;
          similarity: number | null;
          student_id: string;
          tutor_id: string;
          tutor_status: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rejected_at?: string | null;
          similarity?: number | null;
          student_id: string;
          tutor_id: string;
          tutor_status?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          rejected_at?: string | null;
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
          exclude_rejected_tutors: boolean;
          id: string;
          in_queue: boolean;
          notes: string | null;
          priority: number;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exclude_rejected_tutors?: boolean;
          id?: string;
          in_queue?: boolean;
          notes?: string | null;
          priority: number;
          status?: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exclude_rejected_tutors?: boolean;
          id?: string;
          in_queue?: boolean;
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
          orientation_completed_at: string | null;
          parent_email: string | null;
          parent_name: string | null;
          parent_phone: string | null;
          phone_number: string | null;
          role: string | null;
          settings_id: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["profile_status"];
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
          orientation_completed_at?: string | null;
          parent_email?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          phone_number?: string | null;
          role?: string | null;
          settings_id: string;
          start_date?: string | null;
          status: Database["public"]["Enums"]["profile_status"];
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
          orientation_completed_at?: string | null;
          parent_email?: string | null;
          parent_name?: string | null;
          parent_phone?: string | null;
          phone_number?: string | null;
          role?: string | null;
          settings_id?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["profile_status"];
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
      session_reminders: {
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
      Sessions: {
        Row: {
          created_at: string;
          date: string | null;
          duration: number;
          enrollment_id: string | null;
          id: string;
          is_first_session: boolean;
          is_question_or_concern: boolean;
          is_standalone: boolean;
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
          is_standalone?: boolean;
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
          is_standalone?: boolean;
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
      weekly_meeting_schedules: {
        Row: {
          created_at: string;
          day_of_week: Database["public"]["Enums"]["day_of_week"];
          description: string;
          end_time: string;
          id: string;
          meeting_id: string | null;
          start_time: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: Database["public"]["Enums"]["day_of_week"];
          description?: string;
          end_time: string;
          id?: string;
          meeting_id?: string | null;
          start_time: string;
          title?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: Database["public"]["Enums"]["day_of_week"];
          description?: string;
          end_time?: string;
          id?: string;
          meeting_id?: string | null;
          start_time?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_schedules_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "Meetings";
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
          zoom_meeting_uuid: string | null;
        };
        Insert: {
          action: string;
          email?: string | null;
          id?: string;
          name: string;
          participant_id: string;
          session_id?: string | null;
          timestamp?: string;
          zoom_meeting_uuid?: string | null;
        };
        Update: {
          action?: string;
          email?: string | null;
          id?: string;
          name?: string;
          participant_id?: string;
          session_id?: string | null;
          timestamp?: string;
          zoom_meeting_uuid?: string | null;
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
      Emails: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: number | null;
          message_id: string | null;
          recipient_id: string | null;
          session_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: number | null;
          message_id?: string | null;
          recipient_id?: string | null;
          session_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: number | null;
          message_id?: string | null;
          recipient_id?: string | null;
          session_id?: string | null;
        };
        Relationships: [];
      };
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
      get_available_tutors: {
        Args: { end_date: string; start_date: string };
        Returns: {
          first_name: string;
          id: string;
          last_name: string;
        }[];
      };
      get_best_matches_cached: {
        Args: { p_student_id: string };
        Returns: {
          embedding_distance: number;
          similarity: number;
          student_id: string;
          tutor_id: string;
        }[];
      };
      get_best_matches_materialized: {
        Args: { p_student_id: string };
        Returns: {
          embedding_distance: number;
          similarity: number;
          student_id: string;
          tutor_id: string;
        }[];
      };
      get_best_match_resolution: {
        Args: { p_student_id: string };
        Returns: {
          embedding_distance: number;
          rejection_reason: string | null;
          similarity: number;
          status: string;
          tutor_id: string;
        }[];
      };
      get_enrollments_with_active_sessions: {
        Args: never;
        Returns: {
          duration: number;
          end_time: string | null;
          frequency: string;
          id: string;
          start_date: string | null;
          start_time: string | null;
          student_id: string | null;
          tutor_id: string | null;
        }[];
      };
      get_most_relevant_tutor_notes: {
        Args: { p_student_id: string; p_subject: string };
        Returns: {
          content: string | null;
          created_at: string;
          id: string;
          profile_id: string;
          subject: string;
        }[];
      };
      get_pairing_logs: {
        Args: { end_time: string; start_time: string };
        Returns: {
          created_at: string | null;
          error: boolean | null;
          id: string;
          message: string;
          metadata: Json | null;
          role: string | null;
          type: string;
        }[];
      };
      get_peer_reviews_for_tutor: {
        Args: { p_tutor_id: string };
        Returns: {
          anonymous: boolean | null;
          content: string | null;
          created_at: string;
          id: string;
          profile_id: string;
          rating: number | null;
          tutor_id: string;
        }[];
      };
      get_session_duration_minutes: {
        Args: { end_date: string; end_time: string; start_date: string; start_time: string };
        Returns: number;
      };
      get_session_notes_for_tutor: {
        Args: { p_tutor_id: string };
        Returns: {
          content: string | null;
          created_at: string;
          id: string;
          session_id: string | null;
          student_id: string | null;
          tutor_id: string | null;
        }[];
      };
      get_sessions_by_date_range: {
        Args: { end_date: string; start_date: string; tutor_id: string };
        Returns: {
          created_at: string;
          date: string | null;
          duration: number;
          enrollment_id: string | null;
          id: string;
          is_first_session: boolean;
          is_question_or_concern: boolean;
          is_standalone: boolean;
          meeting_id: string | null;
          session_exit_form: string | null;
          status: string | null;
          student_id: string | null;
          summary: string | null;
          tutor_id: string | null;
        }[];
      };
      get_top_tutor_recommendations: {
        Args: { input_enrollment_id: string; input_limit: number };
        Returns: Json;
      };
      get_tutors_by_subject: {
        Args: { input_subject: string };
        Returns: {
          email: string | null;
          first_name: string;
          id: string;
          last_name: string;
          subjects_of_interest: string[] | null;
        }[];
      };
      get_unmatched_student_count: {
        Args: never;
        Returns: number;
      };
      isduplicate: {
        Args: { search_string: string };
        Returns: boolean;
      };
      rpc_first_session_metric: {
        Args: { end_time: string; start_time: string };
        Returns: {
          count: number;
          metric_name: string;
          percent_of_total: number;
        }[];
      };
    };
    Enums: {
      day_of_week:
        "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
      event_type: "Training" | "Conference" | "Workshop" | "Meeting" | "Other";
      profile_status: "active" | "inactive" | "deleted" | "pending";
      session_frequency: "weekly" | "biweekly" | "monthly" | "as_needed";
      session_status: "completed" | "cancelled" | "scheduled";
      timezone:
        | "America/New_York"
        | "America/Chicago"
        | "America/Denver"
        | "America/Los_Angeles"
        | "America/Anchorage"
        | "Pacific/Honolulu"
        | "UTC";
    };
    CompositeTypes: {};
  };
};
