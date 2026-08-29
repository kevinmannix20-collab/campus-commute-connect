export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          school_email: string;
          created_at: string;
          school: string | null;
          degree_pursuit: string | null;
          graduation_year: number | null;
        };
        Insert: {
          id: string;
          full_name: string;
          school_email: string;
          created_at?: string;
          school?: string | null;
          degree_pursuit?: string | null;
          graduation_year?: number | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          school_email?: string;
          created_at?: string;
          school?: string | null;
          degree_pursuit?: string | null;
          graduation_year?: number | null;
        };
        Relationships: [];
      };
      trip_requests: {
        Row: {
          id: string;
          user_id: string;
          starting_point: string;
          starting_point_lat: number | null;
          starting_point_lng: number | null;
          destination: string;
          destination_lat: number | null;
          destination_lng: number | null;
          requested_time: string;
          mode: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          starting_point: string;
          starting_point_lat?: number | null;
          starting_point_lng?: number | null;
          destination: string;
          destination_lat?: number | null;
          destination_lng?: number | null;
          requested_time: string;
          mode: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          starting_point?: string;
          starting_point_lat?: number | null;
          starting_point_lng?: number | null;
          destination?: string;
          destination_lat?: number | null;
          destination_lng?: number | null;
          requested_time?: string;
          mode?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
          status: string;
          completed_at: string | null;
          completed_by: string | null;
          driver_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
          status?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          driver_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_request_id_a?: string;
          trip_request_id_b?: string;
          status?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          driver_user_id?: string | null;
          created_at?: string;
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
      ratings: {
        Row: {
          id: string;
          trip_id: string;
          rater_id: string;
          ratee_id: string;
          stars: number | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          rater_id: string;
          ratee_id: string;
          stars?: number | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          rater_id?: string;
          ratee_id?: string;
          stars?: number | null;
          comment?: string | null;
          created_at?: string;
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
      bus_group_members: {
        Row: {
          id: string;
          trip_request_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          trip_request_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          trip_request_id?: string;
          user_id?: string;
          joined_at?: string;
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
      trip_request_companions: {
        Row: {
          id: string;
          trip_request_id: string;
          user_id: string;
          added_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_request_id: string;
          user_id: string;
          added_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_request_id?: string;
          user_id?: string;
          added_by?: string;
          created_at?: string;
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
      messages: {
        Row: {
          id: string;
          match_id: string | null;
          bus_trip_request_id: string | null;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id?: string | null;
          bus_trip_request_id?: string | null;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string | null;
          bus_trip_request_id?: string | null;
          sender_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_bus_trip_request_id_fkey";
            columns: ["bus_trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          match_id: string | null;
          bus_trip_request_id: string | null;
          message_id: string | null;
          actor_id: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          match_id?: string | null;
          bus_trip_request_id?: string | null;
          message_id?: string | null;
          actor_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          match_id?: string | null;
          bus_trip_request_id?: string | null;
          message_id?: string | null;
          actor_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_bus_trip_request_id_fkey";
            columns: ["bus_trip_request_id"];
            isOneToOne: false;
            referencedRelation: "trip_requests";
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_match: {
        Args: { request_a: string; request_b: string };
        Returns: {
          id: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
          status: string;
          completed_at: string | null;
          completed_by: string | null;
          driver_user_id: string | null;
          created_at: string;
        };
      };
      open_trip_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          requester_id: string;
          starting_point: string;
          destination: string;
          requested_time: string;
          mode: string;
          created_at: string;
          requester_display_name: string;
          requester_average_stars: number | null;
          requester_completed_trip_count: number;
          requester_rides_given: number;
          bus_member_count: number | null;
          companion_display_names: string[];
          requester_school: string | null;
          requester_degree_pursuit: string | null;
        }[];
      };
      my_matches: {
        Args: Record<PropertyKey, never>;
        Returns: {
          match_id: string;
          match_status: string;
          match_created_at: string;
          completed_at: string | null;
          my_trip_request_id: string;
          my_requested_time: string;
          counterpart_trip_request_id: string;
          counterpart_id: string;
          counterpart_display_name: string;
          counterpart_starting_point: string;
          counterpart_destination: string;
          counterpart_requested_time: string;
          counterpart_mode: string;
        }[];
      };
      mark_trip_completed: {
        Args: { p_trip_id: string };
        Returns: {
          id: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
          status: string;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
        };
      };
      submit_rating: {
        Args: { p_trip_id: string; p_stars?: number | null; p_comment?: string | null };
        Returns: {
          id: string;
          trip_id: string;
          rater_id: string;
          ratee_id: string;
          stars: number | null;
          comment: string | null;
          created_at: string;
        };
      };
      profile_stats: {
        Args: { p_user_id: string };
        Returns: {
          full_name: string;
          average_stars: number | null;
          completed_trip_count: number;
          rides_given: number;
          member_since: string;
          school: string | null;
          degree_pursuit: string | null;
          graduation_year: number | null;
        }[];
      };
      profile_reviews: {
        Args: { p_user_id: string };
        Returns: {
          rater_name: string;
          stars: number | null;
          comment: string | null;
          created_at: string;
        }[];
      };
      my_trip_history: {
        Args: Record<PropertyKey, never>;
        Returns: {
          trip_id: string;
          completed_at: string | null;
          counterpart_id: string;
          counterpart_name: string;
          my_destination: string;
          counterpart_destination: string;
          requested_time: string;
        }[];
      };
      my_rating_activity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          trip_id: string;
          direction: string;
          counterpart_id: string;
          counterpart_name: string;
          stars: number | null;
          comment: string | null;
          created_at: string;
        }[];
      };
      join_bus_group: {
        Args: { p_trip_request_id: string };
        Returns: undefined;
      };
      my_bus_groups: {
        Args: Record<PropertyKey, never>;
        Returns: {
          trip_request_id: string;
          role: string;
          starting_point: string;
          destination: string;
          requested_time: string;
          member_count: number;
          other_display_names: string[];
        }[];
      };
      thread_participants: {
        Args: { p_thread_type: string; p_thread_id: string };
        Returns: {
          user_id: string;
          display_name: string;
        }[];
      };
      search_profiles: {
        Args: { p_query: string };
        Returns: {
          id: string;
          display_name: string;
        }[];
      };
      my_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          type: string;
          match_id: string | null;
          bus_trip_request_id: string | null;
          actor_display_name: string | null;
          preview: string | null;
          created_at: string;
          read_at: string | null;
        }[];
      };
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      mark_thread_notifications_read: {
        Args: { p_thread_type: string; p_thread_id: string };
        Returns: undefined;
      };
      my_message_threads: {
        Args: Record<PropertyKey, never>;
        Returns: {
          thread_type: string;
          thread_id: string;
          title: string;
          last_message_body: string | null;
          last_message_at: string | null;
          unread_count: number;
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
