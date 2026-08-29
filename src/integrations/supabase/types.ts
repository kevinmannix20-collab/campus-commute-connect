export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      bus_group_members: {
        Row: {
          id: string;
          joined_at: string;
          trip_request_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          trip_request_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          trip_request_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bus_group_members_trip_request_id_fkey";
            columns: ["trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          driver_user_id: string | null;
          id: string;
          status: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
        };
        Insert: {
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          driver_user_id?: string | null;
          id?: string;
          status?: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
        };
        Update: {
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          driver_user_id?: string | null;
          id?: string;
          status?: string;
          trip_request_id_a?: string;
          trip_request_id_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_trip_request_id_a_fkey";
            columns: ["trip_request_id_a"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_trip_request_id_b_fkey";
            columns: ["trip_request_id_b"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          bus_trip_request_id: string | null;
          created_at: string;
          id: string;
          match_id: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          bus_trip_request_id?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          bus_trip_request_id?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_bus_trip_request_id_fkey";
            columns: ["bus_trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          bus_trip_request_id: string | null;
          created_at: string;
          id: string;
          match_id: string | null;
          message_id: string | null;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          actor_id?: string | null;
          bus_trip_request_id?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          message_id?: string | null;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          bus_trip_request_id?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string | null;
          message_id?: string | null;
          read_at?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_bus_trip_request_id_fkey";
            columns: ["bus_trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_details: {
        Row: {
          conversation_style: string | null;
          dream_role_or_company: string | null;
          fragrance_free_preferred: boolean | null;
          fun_fact: string | null;
          hobbies: string[];
          hometown: string | null;
          languages_spoken: string | null;
          music_preference: string[];
          ok_with_food_drink: boolean | null;
          open_to_networking_chat: boolean | null;
          pet_preference: string | null;
          target_field: string | null;
          temperature_preference: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversation_style?: string | null;
          dream_role_or_company?: string | null;
          fragrance_free_preferred?: boolean | null;
          fun_fact?: string | null;
          hobbies?: string[];
          hometown?: string | null;
          languages_spoken?: string | null;
          music_preference?: string[];
          ok_with_food_drink?: boolean | null;
          open_to_networking_chat?: boolean | null;
          pet_preference?: string | null;
          target_field?: string | null;
          temperature_preference?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_style?: string | null;
          dream_role_or_company?: string | null;
          fragrance_free_preferred?: boolean | null;
          fun_fact?: string | null;
          hobbies?: string[];
          hometown?: string | null;
          languages_spoken?: string | null;
          music_preference?: string[];
          ok_with_food_drink?: boolean | null;
          open_to_networking_chat?: boolean | null;
          pet_preference?: string | null;
          target_field?: string | null;
          temperature_preference?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          degree_pursuit: string | null;
          full_name: string;
          graduation_year: number | null;
          home_address: string | null;
          home_lat: number | null;
          home_lng: number | null;
          id: string;
          school: string | null;
          school_email: string;
        };
        Insert: {
          created_at?: string;
          degree_pursuit?: string | null;
          full_name: string;
          graduation_year?: number | null;
          home_address?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          id: string;
          school?: string | null;
          school_email: string;
        };
        Update: {
          created_at?: string;
          degree_pursuit?: string | null;
          full_name?: string;
          graduation_year?: number | null;
          home_address?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          id?: string;
          school?: string | null;
          school_email?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          ratee_id: string;
          rater_id: string;
          stars: number | null;
          trip_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          ratee_id: string;
          rater_id: string;
          stars?: number | null;
          trip_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          ratee_id?: string;
          rater_id?: string;
          stars?: number | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_request_companions: {
        Row: {
          added_by: string;
          created_at: string;
          id: string;
          trip_request_id: string;
          user_id: string;
        };
        Insert: {
          added_by: string;
          created_at?: string;
          id?: string;
          trip_request_id: string;
          user_id: string;
        };
        Update: {
          added_by?: string;
          created_at?: string;
          id?: string;
          trip_request_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_request_companions_trip_request_id_fkey";
            columns: ["trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_requests: {
        Row: {
          created_at: string;
          destination: string;
          destination_lat: number | null;
          destination_lng: number | null;
          id: string;
          mode: string;
          requested_time: string;
          starting_point: string;
          starting_point_lat: number | null;
          starting_point_lng: number | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          destination: string;
          destination_lat?: number | null;
          destination_lng?: number | null;
          id?: string;
          mode: string;
          requested_time: string;
          starting_point: string;
          starting_point_lat?: number | null;
          starting_point_lng?: number | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          destination?: string;
          destination_lat?: number | null;
          destination_lng?: number | null;
          id?: string;
          mode?: string;
          requested_time?: string;
          starting_point?: string;
          starting_point_lat?: number | null;
          starting_point_lng?: number | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_match: {
        Args: { request_a: string; request_b: string };
        Returns: {
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          driver_user_id: string | null;
          id: string;
          status: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
        };
        SetofOptions: {
          from: "*";
          to: "matches";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_bus_group: {
        Args: { p_trip_request_id: string };
        Returns: undefined;
      };
      mark_all_notifications_read: { Args: never; Returns: undefined };
      mark_thread_notifications_read: {
        Args: { p_thread_id: string; p_thread_type: string };
        Returns: undefined;
      };
      mark_trip_completed: {
        Args: { p_trip_id: string };
        Returns: {
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          driver_user_id: string | null;
          id: string;
          status: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
        };
        SetofOptions: {
          from: "*";
          to: "matches";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      my_bus_groups: {
        Args: never;
        Returns: {
          destination: string;
          member_count: number;
          other_display_names: string[];
          requested_time: string;
          role: string;
          starting_point: string;
          trip_request_id: string;
        }[];
      };
      my_matches: {
        Args: never;
        Returns: {
          completed_at: string;
          counterpart_destination: string;
          counterpart_display_name: string;
          counterpart_id: string;
          counterpart_mode: string;
          counterpart_requested_time: string;
          counterpart_starting_point: string;
          counterpart_trip_request_id: string;
          match_created_at: string;
          match_id: string;
          match_status: string;
          my_requested_time: string;
          my_trip_request_id: string;
        }[];
      };
      my_message_threads: {
        Args: never;
        Returns: {
          last_message_at: string;
          last_message_body: string;
          thread_id: string;
          thread_type: string;
          title: string;
          unread_count: number;
        }[];
      };
      my_notifications: {
        Args: never;
        Returns: {
          actor_display_name: string;
          bus_trip_request_id: string;
          created_at: string;
          id: string;
          match_id: string;
          preview: string;
          read_at: string;
          type: string;
        }[];
      };
      my_rating_activity: {
        Args: never;
        Returns: {
          comment: string;
          counterpart_id: string;
          counterpart_name: string;
          created_at: string;
          direction: string;
          stars: number;
          trip_id: string;
        }[];
      };
      my_trip_history: {
        Args: never;
        Returns: {
          completed_at: string;
          counterpart_destination: string;
          counterpart_id: string;
          counterpart_name: string;
          my_destination: string;
          requested_time: string;
          trip_id: string;
        }[];
      };
      open_trip_requests: {
        Args: never;
        Returns: {
          bus_member_count: number;
          companion_display_names: string[];
          created_at: string;
          destination: string;
          destination_lat: number;
          destination_lng: number;
          id: string;
          mode: string;
          requested_time: string;
          requester_average_stars: number;
          requester_completed_trip_count: number;
          requester_degree_pursuit: string;
          requester_display_name: string;
          requester_id: string;
          requester_open_to_networking_chat: boolean;
          requester_rides_given: number;
          requester_school: string;
          starting_point: string;
        }[];
      };
      profile_reviews: {
        Args: { p_user_id: string };
        Returns: {
          comment: string;
          created_at: string;
          rater_name: string;
          stars: number;
        }[];
      };
      profile_stats: {
        Args: { p_user_id: string };
        Returns: {
          average_stars: number;
          completed_trip_count: number;
          degree_pursuit: string;
          full_name: string;
          graduation_year: number;
          member_since: string;
          open_to_networking_chat: boolean;
          rides_given: number;
          school: string;
        }[];
      };
      search_profiles: {
        Args: { p_query: string };
        Returns: {
          display_name: string;
          id: string;
        }[];
      };
      submit_rating: {
        Args: { p_comment?: string; p_stars?: number; p_trip_id: string };
        Returns: {
          comment: string | null;
          created_at: string;
          id: string;
          ratee_id: string;
          rater_id: string;
          stars: number | null;
          trip_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ratings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      thread_participants: {
        Args: { p_thread_id: string; p_thread_type: string };
        Returns: {
          display_name: string;
          user_id: string;
        }[];
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
