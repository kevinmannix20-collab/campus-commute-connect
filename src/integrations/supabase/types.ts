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
        };
        Insert: {
          id: string;
          full_name: string;
          school_email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          school_email?: string;
          created_at?: string;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_request_id_a: string;
          trip_request_id_b: string;
          status?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_request_id_a?: string;
          trip_request_id_b?: string;
          status?: string;
          completed_at?: string | null;
          completed_by?: string | null;
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
        Args: { p_trip_id: string; p_stars: number | null; p_comment: string | null };
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
