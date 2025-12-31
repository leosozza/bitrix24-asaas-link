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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asaas_configurations: {
        Row: {
          api_key: string | null
          created_at: string
          environment: Database["public"]["Enums"]["asaas_environment"]
          id: string
          is_active: boolean
          tenant_id: string
          updated_at: string
          webhook_configured: boolean
          webhook_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["asaas_environment"]
          id?: string
          is_active?: boolean
          tenant_id: string
          updated_at?: string
          webhook_configured?: boolean
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["asaas_environment"]
          id?: string
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
          webhook_configured?: boolean
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bitrix_installations: {
        Row: {
          access_token: string | null
          app_id: string | null
          application_token: string | null
          bitrix_user_id: string | null
          client_endpoint: string | null
          created_at: string
          domain: string
          expires_at: string | null
          id: string
          member_id: string | null
          pay_systems_registered: boolean
          refresh_token: string | null
          robots_registered: boolean | null
          scope: string | null
          server_endpoint: string | null
          status: Database["public"]["Enums"]["bitrix_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          app_id?: string | null
          application_token?: string | null
          bitrix_user_id?: string | null
          client_endpoint?: string | null
          created_at?: string
          domain: string
          expires_at?: string | null
          id?: string
          member_id?: string | null
          pay_systems_registered?: boolean
          refresh_token?: string | null
          robots_registered?: boolean | null
          scope?: string | null
          server_endpoint?: string | null
          status?: Database["public"]["Enums"]["bitrix_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          app_id?: string | null
          application_token?: string | null
          bitrix_user_id?: string | null
          client_endpoint?: string | null
          created_at?: string
          domain?: string
          expires_at?: string | null
          id?: string
          member_id?: string | null
          pay_systems_registered?: boolean
          refresh_token?: string | null
          robots_registered?: boolean | null
          scope?: string | null
          server_endpoint?: string | null
          status?: Database["public"]["Enums"]["bitrix_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitrix_installations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bitrix_pay_systems: {
        Row: {
          created_at: string
          entity_type: string | null
          handler_id: string | null
          id: string
          installation_id: string
          is_active: boolean
          pay_system_id: string | null
          payment_method: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type?: string | null
          handler_id?: string | null
          id?: string
          installation_id: string
          is_active?: boolean
          pay_system_id?: string | null
          payment_method: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string | null
          handler_id?: string | null
          id?: string
          installation_id?: string
          is_active?: boolean
          pay_system_id?: string | null
          payment_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitrix_pay_systems_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "bitrix_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_configurations: {
        Row: {
          auto_emit_on_payment: boolean
          created_at: string
          default_iss: number | null
          id: string
          is_active: boolean
          municipal_service_code: string | null
          municipal_service_id: string | null
          municipal_service_name: string | null
          observations_template: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_emit_on_payment?: boolean
          created_at?: string
          default_iss?: number | null
          id?: string
          is_active?: boolean
          municipal_service_code?: string | null
          municipal_service_id?: string | null
          municipal_service_name?: string | null
          observations_template?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_emit_on_payment?: boolean
          created_at?: string
          default_iss?: number | null
          id?: string
          is_active?: boolean
          municipal_service_code?: string | null
          municipal_service_id?: string | null
          municipal_service_name?: string | null
          observations_template?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          request_data: Json | null
          response_data: Json | null
          status: Database["public"]["Enums"]["log_status"]
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status: Database["public"]["Enums"]["log_status"]
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: Database["public"]["Enums"]["log_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          asaas_invoice_id: string | null
          bitrix_entity_id: string | null
          bitrix_entity_type:
            | Database["public"]["Enums"]["bitrix_entity_type"]
            | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          effective_date: string | null
          error_message: string | null
          external_reference: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          observations: string | null
          service_description: string
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          transaction_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_invoice_id?: string | null
          bitrix_entity_id?: string | null
          bitrix_entity_type?:
            | Database["public"]["Enums"]["bitrix_entity_type"]
            | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          effective_date?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          observations?: string | null
          service_description: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          transaction_id?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          asaas_invoice_id?: string | null
          bitrix_entity_id?: string | null
          bitrix_entity_type?:
            | Database["public"]["Enums"]["bitrix_entity_type"]
            | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          effective_date?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          observations?: string | null
          service_description?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string
          transaction_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connections: {
        Row: {
          api_key_encrypted: string | null
          auth_type: string
          created_at: string
          id: string
          is_enabled: boolean
          last_sync_at: string | null
          mcp_url: string
          name: string
          tenant_id: string
          tools_count: number
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          auth_type?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          mcp_url: string
          name: string
          tenant_id: string
          tools_count?: number
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          auth_type?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          mcp_url?: string
          name?: string
          tenant_id?: string
          tools_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tools: {
        Row: {
          connection_id: string
          created_at: string
          description: string | null
          id: string
          input_schema: Json | null
          is_exposed: boolean
          name: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json | null
          is_exposed?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          description?: string | null
          id?: string
          input_schema?: Json | null
          is_exposed?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tools_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "mcp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bitrix_domain: string | null
          company_name: string
          created_at: string
          email: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          bitrix_domain?: string | null
          company_name: string
          created_at?: string
          email: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          bitrix_domain?: string | null
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      split_configurations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          split_type: Database["public"]["Enums"]["split_type"]
          split_value: number
          tenant_id: string
          updated_at: string
          wallet_id: string
          wallet_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          split_type?: Database["public"]["Enums"]["split_type"]
          split_value: number
          tenant_id: string
          updated_at?: string
          wallet_id: string
          wallet_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          split_type?: Database["public"]["Enums"]["split_type"]
          split_value?: number
          tenant_id?: string
          updated_at?: string
          wallet_id?: string
          wallet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "split_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean
          name: string
          price: number
          transaction_limit: number
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          transaction_limit: number
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          transaction_limit?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_id: string
          billing_type: Database["public"]["Enums"]["payment_method"]
          bitrix_entity_id: string | null
          bitrix_entity_type:
            | Database["public"]["Enums"]["bitrix_status"]
            | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_id: string
          customer_name: string | null
          cycle: Database["public"]["Enums"]["subscription_cycle"]
          description: string | null
          id: string
          next_due_date: string | null
          status: Database["public"]["Enums"]["subscription_status_asaas"]
          tenant_id: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_id: string
          billing_type: Database["public"]["Enums"]["payment_method"]
          bitrix_entity_id?: string | null
          bitrix_entity_type?:
            | Database["public"]["Enums"]["bitrix_status"]
            | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_id: string
          customer_name?: string | null
          cycle: Database["public"]["Enums"]["subscription_cycle"]
          description?: string | null
          id?: string
          next_due_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status_asaas"]
          tenant_id: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_id?: string
          billing_type?: Database["public"]["Enums"]["payment_method"]
          bitrix_entity_id?: string | null
          bitrix_entity_type?:
            | Database["public"]["Enums"]["bitrix_status"]
            | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_id?: string
          customer_name?: string | null
          cycle?: Database["public"]["Enums"]["subscription_cycle"]
          description?: string | null
          id?: string
          next_due_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status_asaas"]
          tenant_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          transactions_used: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          transactions_used?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          transactions_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_splits: {
        Row: {
          created_at: string
          id: string
          split_amount: number
          split_type: Database["public"]["Enums"]["split_type"]
          split_value: number
          transaction_id: string
          wallet_id: string
          wallet_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          split_amount: number
          split_type: Database["public"]["Enums"]["split_type"]
          split_value: number
          transaction_id: string
          wallet_id: string
          wallet_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          split_amount?: number
          split_type?: Database["public"]["Enums"]["split_type"]
          split_value?: number
          transaction_id?: string
          wallet_id?: string
          wallet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          asaas_id: string | null
          bitrix_entity_id: string | null
          bitrix_entity_type:
            | Database["public"]["Enums"]["bitrix_entity_type"]
            | null
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_url: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_id?: string | null
          bitrix_entity_id?: string | null
          bitrix_entity_type?:
            | Database["public"]["Enums"]["bitrix_entity_type"]
            | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          payment_date?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_url?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_id?: string | null
          bitrix_entity_id?: string | null
          bitrix_entity_type?:
            | Database["public"]["Enums"]["bitrix_entity_type"]
            | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_url?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      asaas_environment: "sandbox" | "production"
      bitrix_entity_type: "deal" | "invoice" | "contact" | "company"
      bitrix_status: "active" | "expired" | "revoked"
      invoice_status:
        | "scheduled"
        | "synchronized"
        | "authorized"
        | "canceled"
        | "error"
      log_status: "success" | "error"
      payment_method: "pix" | "boleto" | "credit_card"
      split_type: "fixed" | "percentage"
      subscription_cycle:
        | "WEEKLY"
        | "BIWEEKLY"
        | "MONTHLY"
        | "BIMONTHLY"
        | "QUARTERLY"
        | "SEMIANNUALLY"
        | "YEARLY"
      subscription_status: "active" | "cancelled" | "expired" | "trial"
      subscription_status_asaas: "active" | "canceled" | "expired" | "pending"
      transaction_status:
        | "pending"
        | "confirmed"
        | "received"
        | "overdue"
        | "refunded"
        | "cancelled"
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
      app_role: ["admin", "user"],
      asaas_environment: ["sandbox", "production"],
      bitrix_entity_type: ["deal", "invoice", "contact", "company"],
      bitrix_status: ["active", "expired", "revoked"],
      invoice_status: [
        "scheduled",
        "synchronized",
        "authorized",
        "canceled",
        "error",
      ],
      log_status: ["success", "error"],
      payment_method: ["pix", "boleto", "credit_card"],
      split_type: ["fixed", "percentage"],
      subscription_cycle: [
        "WEEKLY",
        "BIWEEKLY",
        "MONTHLY",
        "BIMONTHLY",
        "QUARTERLY",
        "SEMIANNUALLY",
        "YEARLY",
      ],
      subscription_status: ["active", "cancelled", "expired", "trial"],
      subscription_status_asaas: ["active", "canceled", "expired", "pending"],
      transaction_status: [
        "pending",
        "confirmed",
        "received",
        "overdue",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const
