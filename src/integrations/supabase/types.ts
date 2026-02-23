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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agency_updates: {
        Row: {
          agency: string
          content: string | null
          created_at: string
          id: string
          published_at: string
          title: string
          update_type: string
          url: string
        }
        Insert: {
          agency: string
          content?: string | null
          created_at?: string
          id?: string
          published_at: string
          title: string
          update_type: string
          url: string
        }
        Update: {
          agency?: string
          content?: string | null
          created_at?: string
          id?: string
          published_at?: string
          title?: string
          update_type?: string
          url?: string
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          metadata: Json | null
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          metadata?: Json | null
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          based_on_opportunities: string[] | null
          confidence_score: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          opportunity_id: string
          recommendation: string
          recommendation_type: string
        }
        Insert: {
          based_on_opportunities?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          opportunity_id: string
          recommendation: string
          recommendation_type: string
        }
        Update: {
          based_on_opportunities?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          opportunity_id?: string
          recommendation?: string
          recommendation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "bd_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_library: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner: string | null
          short_summary: string | null
          source_item_id: string | null
          source_pipeline_id: string | null
          status_tag: string | null
          time_horizon: string | null
          title: string
          updated_at: string
          urgency_level: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner?: string | null
          short_summary?: string | null
          source_item_id?: string | null
          source_pipeline_id?: string | null
          status_tag?: string | null
          time_horizon?: string | null
          title: string
          updated_at?: string
          urgency_level?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner?: string | null
          short_summary?: string | null
          source_item_id?: string | null
          source_pipeline_id?: string | null
          status_tag?: string | null
          time_horizon?: string | null
          title?: string
          updated_at?: string
          urgency_level?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_library_source_pipeline_id_fkey"
            columns: ["source_pipeline_id"]
            isOneToOne: false
            referencedRelation: "meeting_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_meeting_pipeline_items: {
        Row: {
          confidence: number | null
          created_at: string
          customer: string | null
          id: string
          name: string
          next_action: string | null
          next_action_due: string | null
          notes: string | null
          owner: string | null
          snapshot_id: string
          sort_order: number | null
          source_text: string | null
          stage: string
          updated_at: string
          value_estimate: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          customer?: string | null
          id?: string
          name: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          owner?: string | null
          snapshot_id: string
          sort_order?: number | null
          source_text?: string | null
          stage?: string
          updated_at?: string
          value_estimate?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          customer?: string | null
          id?: string
          name?: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          owner?: string | null
          snapshot_id?: string
          sort_order?: number | null
          source_text?: string | null
          stage?: string
          updated_at?: string
          value_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bd_meeting_pipeline_items_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "bd_meeting_pipeline_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_meeting_pipeline_snapshots: {
        Row: {
          created_at: string
          id: string
          meeting_date: string
          notes: string | null
          raw_transcript: string | null
          title: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_date: string
          notes?: string | null
          raw_transcript?: string | null
          title: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          raw_transcript?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      bd_notification_history: {
        Row: {
          details: Json | null
          id: string
          notification_type: string
          opportunity_id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          details?: Json | null
          id?: string
          notification_type: string
          opportunity_id: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          details?: Json | null
          id?: string
          notification_type?: string
          opportunity_id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_notification_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "bd_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_notification_preferences: {
        Row: {
          created_at: string | null
          due_date_warning_days: number | null
          email: string
          id: string
          notify_due_dates: boolean | null
          notify_health_changes: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          due_date_warning_days?: number | null
          email: string
          id?: string
          notify_due_dates?: boolean | null
          notify_health_changes?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          due_date_warning_days?: number | null
          email?: string
          id?: string
          notify_due_dates?: boolean | null
          notify_health_changes?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bd_opportunities: {
        Row: {
          created_at: string | null
          id: string
          name: string
          opportunity_id: string | null
          owner: string | null
          short_name: string | null
          status: string | null
          supporting_owners: string[] | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          opportunity_id?: string | null
          owner?: string | null
          short_name?: string | null
          status?: string | null
          supporting_owners?: string[] | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          opportunity_id?: string | null
          owner?: string | null
          short_name?: string | null
          status?: string | null
          supporting_owners?: string[] | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_opportunity_status: {
        Row: {
          band: string
          created_at: string | null
          due_date: string | null
          flags: Json | null
          health: string
          id: string
          linked_opportunity_id: string | null
          opportunity_id: string
          raw_notes: string | null
          source_transcript_id: string | null
          summary: string | null
          updated_at: string | null
          week_of: string
        }
        Insert: {
          band: string
          created_at?: string | null
          due_date?: string | null
          flags?: Json | null
          health: string
          id?: string
          linked_opportunity_id?: string | null
          opportunity_id: string
          raw_notes?: string | null
          source_transcript_id?: string | null
          summary?: string | null
          updated_at?: string | null
          week_of: string
        }
        Update: {
          band?: string
          created_at?: string | null
          due_date?: string | null
          flags?: Json | null
          health?: string
          id?: string
          linked_opportunity_id?: string | null
          opportunity_id?: string
          raw_notes?: string | null
          source_transcript_id?: string | null
          summary?: string | null
          updated_at?: string | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "bd_opportunity_status_linked_opportunity_id_fkey"
            columns: ["linked_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_opportunity_status_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "bd_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bd_opportunity_status_source_transcript_id_fkey"
            columns: ["source_transcript_id"]
            isOneToOne: false
            referencedRelation: "bd_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      bd_transcripts: {
        Row: {
          created_at: string | null
          id: string
          label: string
          raw_text: string
          uploaded_by: string
          user_id: string
          week_of: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          raw_text: string
          uploaded_by: string
          user_id: string
          week_of: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          raw_text?: string
          uploaded_by?: string
          user_id?: string
          week_of?: string
        }
        Relationships: []
      }
      brain_settings: {
        Row: {
          brain_summary: string | null
          created_at: string
          id: string
          tags: string[] | null
          updated_at: string
          user_id: string
          writing_style: string | null
        }
        Insert: {
          brain_summary?: string | null
          created_at?: string
          id?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          writing_style?: string | null
        }
        Update: {
          brain_summary?: string | null
          created_at?: string
          id?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          writing_style?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          color_hex: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          event_type: string
          icon_name: string | null
          id: string
          invite_email: string | null
          location: string | null
          registration_url: string | null
          start_date: string
          start_time: string | null
          title: string
          type: string | null
          type_custom: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          color_hex?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type: string
          icon_name?: string | null
          id?: string
          invite_email?: string | null
          location?: string | null
          registration_url?: string | null
          start_date: string
          start_time?: string | null
          title: string
          type?: string | null
          type_custom?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          color_hex?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_type?: string
          icon_name?: string | null
          id?: string
          invite_email?: string | null
          location?: string | null
          registration_url?: string | null
          start_date?: string
          start_time?: string | null
          title?: string
          type?: string | null
          type_custom?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      capability_documents: {
        Row: {
          capability_id: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capability_documents_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "company_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "reference_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          opportunity_context: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          opportunity_context?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          opportunity_context?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_capabilities: {
        Row: {
          capability_name: string
          created_at: string | null
          description: string | null
          id: string
          keywords: string[]
          priority: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capability_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          keywords: string[]
          priority?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capability_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          keywords?: string[]
          priority?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          contract_vehicles: string[] | null
          created_at: string | null
          id: string
          key_customers: string[] | null
          past_performance_areas: string[] | null
          set_asides: string[] | null
          target_agencies: string[] | null
          technical_expertise: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contract_vehicles?: string[] | null
          created_at?: string | null
          id?: string
          key_customers?: string[] | null
          past_performance_areas?: string[] | null
          set_asides?: string[] | null
          target_agencies?: string[] | null
          technical_expertise?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contract_vehicles?: string[] | null
          created_at?: string | null
          id?: string
          key_customers?: string[] | null
          past_performance_areas?: string[] | null
          set_asides?: string[] | null
          target_agencies?: string[] | null
          technical_expertise?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_status_board: {
        Row: {
          category: string | null
          created_at: string | null
          due_date: string | null
          health: string | null
          id: string
          last_updated: string | null
          opportunity_name: string
          owner: string | null
          short_name: string | null
          source_transcript_id: string | null
          status_summary: string | null
          user_id: string
          week_of: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          due_date?: string | null
          health?: string | null
          id?: string
          last_updated?: string | null
          opportunity_name: string
          owner?: string | null
          short_name?: string | null
          source_transcript_id?: string | null
          status_summary?: string | null
          user_id: string
          week_of: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          due_date?: string | null
          health?: string | null
          id?: string
          last_updated?: string | null
          opportunity_name?: string
          owner?: string | null
          short_name?: string | null
          source_transcript_id?: string | null
          status_summary?: string | null
          user_id?: string
          week_of?: string
        }
        Relationships: []
      }
      company_status_transcripts: {
        Row: {
          created_at: string | null
          id: string
          label: string
          raw_text: string
          uploaded_by: string
          user_id: string
          week_of: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          raw_text: string
          uploaded_by: string
          user_id: string
          week_of: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          raw_text?: string
          uploaded_by?: string
          user_id?: string
          week_of?: string
        }
        Relationships: []
      }
      conference_collaborators: {
        Row: {
          conference_id: string
          created_at: string
          id: string
          invited_by: string
          role: string
          user_id: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          id?: string
          invited_by: string
          role?: string
          user_id: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          id?: string
          invited_by?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_collaborators_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_share_links: {
        Row: {
          id: string
          conference_id: string
          token: string
          created_by: string
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conference_id: string
          token: string
          created_by: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conference_id?: string
          token?: string
          created_by?: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_share_links_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_voice_recaps: {
        Row: {
          id: string
          conference_id: string
          lead_id: string | null
          recorded_by: string
          audio_url: string | null
          transcript: string | null
          ai_summary: string | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conference_id: string
          lead_id?: string | null
          recorded_by: string
          audio_url?: string | null
          transcript?: string | null
          ai_summary?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conference_id?: string
          lead_id?: string | null
          recorded_by?: string
          audio_url?: string | null
          transcript?: string | null
          ai_summary?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_voice_recaps_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_voice_recaps_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "conference_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_leads: {
        Row: {
          ai_fit_score: number | null
          ai_reason: string | null
          card_image_url: string | null
          company: string
          conference_id: string
          contact_name: string
          created_at: string
          created_by: string
          email: string | null
          id: string
          linked_opportunity_id: string | null
          notes: string | null
          phone: string | null
          source: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_fit_score?: number | null
          ai_reason?: string | null
          card_image_url?: string | null
          company: string
          conference_id: string
          contact_name: string
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          linked_opportunity_id?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_fit_score?: number | null
          ai_reason?: string | null
          card_image_url?: string | null
          company?: string
          conference_id?: string
          contact_name?: string
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          linked_opportunity_id?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_leads_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conference_leads_linked_opportunity_id_fkey"
            columns: ["linked_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      conferences: {
        Row: {
          archived: boolean
          calendar_event_id: string | null
          calendar_source: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          exec_summary: Json | null
          exec_summary_generated_at: string | null
          id: string
          location: string
          name: string
          source_url: string | null
          start_date: string
          tags: string[] | null
          updated_at: string
          website_data: Json | null
        }
        Insert: {
          archived?: boolean
          calendar_event_id?: string | null
          calendar_source?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          exec_summary?: Json | null
          exec_summary_generated_at?: string | null
          id?: string
          location: string
          name: string
          source_url?: string | null
          start_date: string
          tags?: string[] | null
          updated_at?: string
          website_data?: Json | null
        }
        Update: {
          archived?: boolean
          calendar_event_id?: string | null
          calendar_source?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          exec_summary?: Json | null
          exec_summary_generated_at?: string | null
          id?: string
          location?: string
          name?: string
          source_url?: string | null
          start_date?: string
          tags?: string[] | null
          updated_at?: string
          website_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conferences_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          notes: string | null
          org_name: string | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          notes?: string | null
          org_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          org_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_awards: {
        Row: {
          ai_company_fit_reason: string | null
          ai_company_fit_score: number | null
          award_amount: number | null
          award_date: string | null
          award_description: string | null
          award_id: string
          awarding_agency: string | null
          awarding_sub_agency: string | null
          contract_type: string | null
          created_at: string | null
          funding_agency: string | null
          id: string
          is_watchlisted: boolean | null
          level: string
          naics_code: string | null
          naics_description: string | null
          period_of_performance_end: string | null
          period_of_performance_start: string | null
          place_of_performance_city: string | null
          place_of_performance_country: string | null
          place_of_performance_state: string | null
          psc_code: string | null
          psc_description: string | null
          raw_data: Json | null
          recipient_duns: string | null
          recipient_name: string
          recipient_uei: string | null
          set_aside_description: string | null
          set_aside_type: string | null
          source: string
          subcontract_lead_reason: string | null
          subcontract_lead_score: number | null
          total_obligation: number | null
          updated_at: string | null
          user_id: string
          watchlist_notes: string | null
        }
        Insert: {
          ai_company_fit_reason?: string | null
          ai_company_fit_score?: number | null
          award_amount?: number | null
          award_date?: string | null
          award_description?: string | null
          award_id: string
          awarding_agency?: string | null
          awarding_sub_agency?: string | null
          contract_type?: string | null
          created_at?: string | null
          funding_agency?: string | null
          id?: string
          is_watchlisted?: boolean | null
          level?: string
          naics_code?: string | null
          naics_description?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          place_of_performance_city?: string | null
          place_of_performance_country?: string | null
          place_of_performance_state?: string | null
          psc_code?: string | null
          psc_description?: string | null
          raw_data?: Json | null
          recipient_duns?: string | null
          recipient_name: string
          recipient_uei?: string | null
          set_aside_description?: string | null
          set_aside_type?: string | null
          source?: string
          subcontract_lead_reason?: string | null
          subcontract_lead_score?: number | null
          total_obligation?: number | null
          updated_at?: string | null
          user_id: string
          watchlist_notes?: string | null
        }
        Update: {
          ai_company_fit_reason?: string | null
          ai_company_fit_score?: number | null
          award_amount?: number | null
          award_date?: string | null
          award_description?: string | null
          award_id?: string
          awarding_agency?: string | null
          awarding_sub_agency?: string | null
          contract_type?: string | null
          created_at?: string | null
          funding_agency?: string | null
          id?: string
          is_watchlisted?: boolean | null
          level?: string
          naics_code?: string | null
          naics_description?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          place_of_performance_city?: string | null
          place_of_performance_country?: string | null
          place_of_performance_state?: string | null
          psc_code?: string | null
          psc_description?: string | null
          raw_data?: Json | null
          recipient_duns?: string | null
          recipient_name?: string
          recipient_uei?: string | null
          set_aside_description?: string | null
          set_aside_type?: string | null
          source?: string
          subcontract_lead_reason?: string | null
          subcontract_lead_score?: number | null
          total_obligation?: number | null
          updated_at?: string | null
          user_id?: string
          watchlist_notes?: string | null
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          brief_date: string
          created_at: string
          id: string
          key_headlines: Json | null
          opportunity_highlights: Json | null
          summary_text: string
          trends: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_date: string
          created_at?: string
          id?: string
          key_headlines?: Json | null
          opportunity_highlights?: Json | null
          summary_text: string
          trends?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_date?: string
          created_at?: string
          id?: string
          key_headlines?: Json | null
          opportunity_highlights?: Json | null
          summary_text?: string
          trends?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_knowledge: {
        Row: {
          analyzed_at: string | null
          capability_mappings: Json | null
          compliance_keywords: string[] | null
          document_id: string
          id: string
          past_performance_patterns: Json | null
          reusable_content: Json | null
          sentiment_analysis: Json | null
          technical_strategies: Json | null
          updated_at: string | null
          user_id: string
          win_themes: Json | null
        }
        Insert: {
          analyzed_at?: string | null
          capability_mappings?: Json | null
          compliance_keywords?: string[] | null
          document_id: string
          id?: string
          past_performance_patterns?: Json | null
          reusable_content?: Json | null
          sentiment_analysis?: Json | null
          technical_strategies?: Json | null
          updated_at?: string | null
          user_id: string
          win_themes?: Json | null
        }
        Update: {
          analyzed_at?: string | null
          capability_mappings?: Json | null
          compliance_keywords?: string[] | null
          document_id?: string
          id?: string
          past_performance_patterns?: Json | null
          reusable_content?: Json | null
          sentiment_analysis?: Json | null
          technical_strategies?: Json | null
          updated_at?: string | null
          user_id?: string
          win_themes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_knowledge_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "reference_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          created_at: string
          document_id: string
          id: string
          permission: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          permission: string
          shared_by: string
          shared_with: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          permission?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "saved_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_size: number | null
          file_type: string
          folder: string | null
          id: string
          knowledge_base_id: string | null
          last_used_at: string | null
          processing_status: string
          storage_path: string
          tags: string[] | null
          updated_at: string
          uploaded_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_size?: number | null
          file_type: string
          folder?: string | null
          id?: string
          knowledge_base_id?: string | null
          last_used_at?: string | null
          processing_status?: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          uploaded_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          folder?: string | null
          id?: string
          knowledge_base_id?: string | null
          last_used_at?: string | null
          processing_status?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      dod_contract_awards: {
        Row: {
          ai_summary: string | null
          announcement_date: string
          award_date: string
          contract_number: string | null
          contract_value: number | null
          contract_value_text: string | null
          created_at: string | null
          description: string
          id: string
          location: string | null
          place_of_performance: string | null
          prime_contractor: string
          relevance_score: number | null
          service_branch: string
          tags: string[] | null
          technology_category: string | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          announcement_date: string
          award_date: string
          contract_number?: string | null
          contract_value?: number | null
          contract_value_text?: string | null
          created_at?: string | null
          description: string
          id?: string
          location?: string | null
          place_of_performance?: string | null
          prime_contractor: string
          relevance_score?: number | null
          service_branch: string
          tags?: string[] | null
          technology_category?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          announcement_date?: string
          award_date?: string
          contract_number?: string | null
          contract_value?: number | null
          contract_value_text?: string | null
          created_at?: string | null
          description?: string
          id?: string
          location?: string | null
          place_of_performance?: string | null
          prime_contractor?: string
          relevance_score?: number | null
          service_branch?: string
          tags?: string[] | null
          technology_category?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      federal_news: {
        Row: {
          created_at: string
          id: string
          published_at: string
          source: string
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          published_at: string
          source: string
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string
          source?: string
          summary?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      hatch_issues: {
        Row: {
          created_at: string | null
          id: string
          processed: boolean | null
          published_at: string | null
          summary_html: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id: string
          processed?: boolean | null
          published_at?: string | null
          summary_html?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          processed?: boolean | null
          published_at?: string | null
          summary_html?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      hunts: {
        Row: {
          agencies: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          keywords: string[] | null
          naics_codes: string[] | null
          name: string
          notice_types: string[] | null
          set_aside_codes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agencies?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          naics_codes?: string[] | null
          name: string
          notice_types?: string[] | null
          set_aside_codes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agencies?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          naics_codes?: string[] | null
          name?: string
          notice_types?: string[] | null
          set_aside_codes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kanban_stages: {
        Row: {
          color: string
          created_at: string
          emoji: string | null
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          created_at: string
          embedding: string | null
          full_text: string | null
          id: string
          ingested_at: string
          metadata: Json | null
          published_at: string | null
          relevance_score: number | null
          source_id: string | null
          source_type: string
          source_url: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          full_text?: string | null
          id?: string
          ingested_at?: string
          metadata?: Json | null
          published_at?: string | null
          relevance_score?: number | null
          source_id?: string | null
          source_type: string
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          full_text?: string | null
          id?: string
          ingested_at?: string
          metadata?: Json | null
          published_at?: string | null
          relevance_score?: number | null
          source_id?: string | null
          source_type?: string
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_digests: {
        Row: {
          action_items: string[] | null
          competitive_intel: Json | null
          created_at: string | null
          digest_date: string
          executive_summary: string
          federal_news_insights: Json | null
          hatch_insights: Json | null
          id: string
          market_trends: Json | null
          podcast_insights: Json | null
          top_opportunities: string[] | null
          user_id: string
          youtube_insights: Json | null
        }
        Insert: {
          action_items?: string[] | null
          competitive_intel?: Json | null
          created_at?: string | null
          digest_date: string
          executive_summary: string
          federal_news_insights?: Json | null
          hatch_insights?: Json | null
          id?: string
          market_trends?: Json | null
          podcast_insights?: Json | null
          top_opportunities?: string[] | null
          user_id: string
          youtube_insights?: Json | null
        }
        Update: {
          action_items?: string[] | null
          competitive_intel?: Json | null
          created_at?: string | null
          digest_date?: string
          executive_summary?: string
          federal_news_insights?: Json | null
          hatch_insights?: Json | null
          id?: string
          market_trends?: Json | null
          podcast_insights?: Json | null
          top_opportunities?: string[] | null
          user_id?: string
          youtube_insights?: Json | null
        }
        Relationships: []
      }
      meeting_notes: {
        Row: {
          action_items: string[] | null
          attendees: string[] | null
          content: string
          created_at: string
          id: string
          meeting_date: string | null
          opportunity_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: string[] | null
          attendees?: string[] | null
          content: string
          created_at?: string
          id?: string
          meeting_date?: string | null
          opportunity_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: string[] | null
          attendees?: string[] | null
          content?: string
          created_at?: string
          id?: string
          meeting_date?: string | null
          opportunity_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_pipeline_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner: string | null
          pipeline_id: string
          short_summary: string | null
          sort_order: number | null
          stage_name: string
          status_tag: string | null
          time_horizon: string | null
          title: string
          updated_at: string
          urgency_level: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner?: string | null
          pipeline_id: string
          short_summary?: string | null
          sort_order?: number | null
          stage_name: string
          status_tag?: string | null
          time_horizon?: string | null
          title: string
          updated_at?: string
          urgency_level?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner?: string | null
          pipeline_id?: string
          short_summary?: string | null
          sort_order?: number | null
          stage_name?: string
          status_tag?: string | null
          time_horizon?: string | null
          title?: string
          updated_at?: string
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_pipeline_items_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "meeting_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_pipelines: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_public: boolean | null
          meeting_date: string | null
          share_token: string | null
          title: string
          transcript_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_public?: boolean | null
          meeting_date?: string | null
          share_token?: string | null
          title: string
          transcript_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_public?: boolean | null
          meeting_date?: string | null
          share_token?: string | null
          title?: string
          transcript_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          active_pursuit: boolean
          agency: string | null
          ai_analysis: Json | null
          ai_brief: Json | null
          ai_brief_updated_at: string | null
          ai_bucket: string | null
          ai_error_message: string | null
          ai_fit_score: number | null
          ai_reason: string | null
          ai_recommendation_reason: string | null
          ai_red_flags: string | null
          ai_scored_at: string | null
          ai_status: string | null
          ai_summary: string | null
          ai_tags: string[] | null
          capability_matches: string[] | null
          contract_vehicle_score: number | null
          created_at: string | null
          created_by: string | null
          customer_alignment_score: number | null
          deadline_alert: string | null
          description: string | null
          description_enriched: string | null
          description_raw: string | null
          description_source: string | null
          due_date: string | null
          external_id: string | null
          external_metadata: Json | null
          external_url: string | null
          fit_score: number | null
          front_end_solutioning: boolean | null
          id: string
          is_user_pursuit: boolean
          last_analyzed_at: string | null
          last_enriched_at: string | null
          last_refreshed_at: string | null
          level: string
          naics: string | null
          notes: string | null
          opportunity_number: string
          position: number | null
          posted_date: string | null
          psc: string | null
          pursuit_status: string | null
          recommended_action: string | null
          recommended_response_type: string | null
          relevance_score: number | null
          sam_id: string | null
          sam_last_refreshed_at: string | null
          set_aside: string | null
          source: string | null
          source_provider: string
          status: string | null
          sub_agency: string | null
          synopsis: string | null
          technical_fit_score: number | null
          title: string
          type: string | null
          updated_at: string | null
          url: string | null
          user_feedback: string | null
          user_id: string
          win_probability_score: number | null
        }
        Insert: {
          active_pursuit?: boolean
          agency?: string | null
          ai_analysis?: Json | null
          ai_brief?: Json | null
          ai_brief_updated_at?: string | null
          ai_bucket?: string | null
          ai_error_message?: string | null
          ai_fit_score?: number | null
          ai_reason?: string | null
          ai_recommendation_reason?: string | null
          ai_red_flags?: string | null
          ai_scored_at?: string | null
          ai_status?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          capability_matches?: string[] | null
          contract_vehicle_score?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_alignment_score?: number | null
          deadline_alert?: string | null
          description?: string | null
          description_enriched?: string | null
          description_raw?: string | null
          description_source?: string | null
          due_date?: string | null
          external_id?: string | null
          external_metadata?: Json | null
          external_url?: string | null
          fit_score?: number | null
          front_end_solutioning?: boolean | null
          id?: string
          is_user_pursuit?: boolean
          last_analyzed_at?: string | null
          last_enriched_at?: string | null
          last_refreshed_at?: string | null
          level?: string
          naics?: string | null
          notes?: string | null
          opportunity_number: string
          position?: number | null
          posted_date?: string | null
          psc?: string | null
          pursuit_status?: string | null
          recommended_action?: string | null
          recommended_response_type?: string | null
          relevance_score?: number | null
          sam_id?: string | null
          sam_last_refreshed_at?: string | null
          set_aside?: string | null
          source?: string | null
          source_provider?: string
          status?: string | null
          sub_agency?: string | null
          synopsis?: string | null
          technical_fit_score?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
          url?: string | null
          user_feedback?: string | null
          user_id: string
          win_probability_score?: number | null
        }
        Update: {
          active_pursuit?: boolean
          agency?: string | null
          ai_analysis?: Json | null
          ai_brief?: Json | null
          ai_brief_updated_at?: string | null
          ai_bucket?: string | null
          ai_error_message?: string | null
          ai_fit_score?: number | null
          ai_reason?: string | null
          ai_recommendation_reason?: string | null
          ai_red_flags?: string | null
          ai_scored_at?: string | null
          ai_status?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          capability_matches?: string[] | null
          contract_vehicle_score?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_alignment_score?: number | null
          deadline_alert?: string | null
          description?: string | null
          description_enriched?: string | null
          description_raw?: string | null
          description_source?: string | null
          due_date?: string | null
          external_id?: string | null
          external_metadata?: Json | null
          external_url?: string | null
          fit_score?: number | null
          front_end_solutioning?: boolean | null
          id?: string
          is_user_pursuit?: boolean
          last_analyzed_at?: string | null
          last_enriched_at?: string | null
          last_refreshed_at?: string | null
          level?: string
          naics?: string | null
          notes?: string | null
          opportunity_number?: string
          position?: number | null
          posted_date?: string | null
          psc?: string | null
          pursuit_status?: string | null
          recommended_action?: string | null
          recommended_response_type?: string | null
          relevance_score?: number | null
          sam_id?: string | null
          sam_last_refreshed_at?: string | null
          set_aside?: string | null
          source?: string | null
          source_provider?: string
          status?: string | null
          sub_agency?: string | null
          synopsis?: string | null
          technical_fit_score?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
          url?: string | null
          user_feedback?: string | null
          user_id?: string
          win_probability_score?: number | null
        }
        Relationships: []
      }
      opportunity_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          opportunity_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_documents_link: {
        Row: {
          document_id: string
          id: string
          linked_at: string
          linked_by: string
          opportunity_id: string
        }
        Insert: {
          document_id: string
          id?: string
          linked_at?: string
          linked_by: string
          opportunity_id: string
        }
        Update: {
          document_id?: string
          id?: string
          linked_at?: string
          linked_by?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_link_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_link_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_hunts: {
        Row: {
          created_at: string
          hunt_id: string
          id: string
          opportunity_id: string
        }
        Insert: {
          created_at?: string
          hunt_id: string
          id?: string
          opportunity_id: string
        }
        Update: {
          created_at?: string
          hunt_id?: string
          id?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_hunts_hunt_id_fkey"
            columns: ["hunt_id"]
            isOneToOne: false
            referencedRelation: "hunts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_hunts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_outcomes: {
        Row: {
          actual_value: number | null
          created_at: string | null
          failure_factors: string[] | null
          id: string
          lessons_learned: string | null
          opportunity_id: string
          outcome: string
          outcome_date: string | null
          success_factors: string[] | null
          updated_at: string | null
          win_probability: number | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          failure_factors?: string[] | null
          id?: string
          lessons_learned?: string | null
          opportunity_id: string
          outcome: string
          outcome_date?: string | null
          success_factors?: string[] | null
          updated_at?: string | null
          win_probability?: number | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          failure_factors?: string[] | null
          id?: string
          lessons_learned?: string | null
          opportunity_id?: string
          outcome?: string
          outcome_date?: string | null
          success_factors?: string[] | null
          updated_at?: string | null
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_outcomes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "bd_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_weightings: {
        Row: {
          created_at: string
          id: string
          last_trained_at: string
          tag_weightings: Json
          training_data_summary: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_trained_at?: string
          tag_weightings?: Json
          training_data_summary?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_trained_at?: string
          tag_weightings?: Json
          training_data_summary?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      podcast_knowledge: {
        Row: {
          actionable_intel: Json | null
          created_at: string | null
          episode_title: string
          episode_url: string
          id: string
          key_insights: string[] | null
          podcast_title: string
          published_at: string | null
          relevance_score: number | null
          relevant_opportunities: string[] | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          actionable_intel?: Json | null
          created_at?: string | null
          episode_title: string
          episode_url: string
          id?: string
          key_insights?: string[] | null
          podcast_title: string
          published_at?: string | null
          relevance_score?: number | null
          relevant_opportunities?: string[] | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          actionable_intel?: Json | null
          created_at?: string | null
          episode_title?: string
          episode_url?: string
          id?: string
          key_insights?: string[] | null
          podcast_title?: string
          published_at?: string | null
          relevance_score?: number | null
          relevant_opportunities?: string[] | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_ai_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          input_context: Json | null
          model_version: string
          opportunity_id: string | null
          output_data: Json | null
          output_summary: string | null
          status: string
          token_usage: Json | null
          user_id: string
          writing_mode: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          input_context?: Json | null
          model_version: string
          opportunity_id?: string | null
          output_data?: Json | null
          output_summary?: string | null
          status?: string
          token_usage?: Json | null
          user_id: string
          writing_mode?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          input_context?: Json | null
          model_version?: string
          opportunity_id?: string | null
          output_data?: Json | null
          output_summary?: string | null
          status?: string
          token_usage?: Json | null
          user_id?: string
          writing_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_ai_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_collaborators: {
        Row: {
          created_at: string
          id: string
          proposal_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposal_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proposal_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_collaborators_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          opportunity_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          opportunity_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_copilot_messages_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          due_date: string | null
          full_submission_draft: string | null
          id: string
          metadata: Json | null
          opportunity_id: string | null
          sections: Json | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          full_submission_draft?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          sections?: Json | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          full_submission_draft?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          sections?: Json | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_documents: {
        Row: {
          active: boolean | null
          content: string
          created_at: string
          document_type: string
          id: string
          parsed_data: Json | null
          storage_path: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string
          document_type: string
          id?: string
          parsed_data?: Json | null
          storage_path?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string
          document_type?: string
          id?: string
          parsed_data?: Json | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sam_job_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          next_run_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          next_run_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          next_run_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sam_rss_subscriptions: {
        Row: {
          agencies: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          last_checked_at: string | null
          naics_codes: string[] | null
          name: string
          notice_types: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agencies?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_checked_at?: string | null
          naics_codes?: string[] | null
          name: string
          notice_types?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agencies?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          last_checked_at?: string | null
          naics_codes?: string[] | null
          name?: string
          notice_types?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sam_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          results: Json
          search_criteria: Json
          search_hash: string
          total_found: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          results: Json
          search_criteria: Json
          search_hash: string
          total_found?: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          results?: Json
          search_criteria?: Json
          search_hash?: string
          total_found?: number
          user_id?: string
        }
        Relationships: []
      }
      sam_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          id: string
          opportunities_refreshed: number | null
          rate_limit_hits: number | null
          scoring_tasks_triggered: number | null
          started_at: string
          status: string | null
          summary: Json | null
          sync_type: string
          total_sam_calls: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          opportunities_refreshed?: number | null
          rate_limit_hits?: number | null
          scoring_tasks_triggered?: number | null
          started_at?: string
          status?: string | null
          summary?: Json | null
          sync_type: string
          total_sam_calls?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          opportunities_refreshed?: number | null
          rate_limit_hits?: number | null
          scoring_tasks_triggered?: number | null
          started_at?: string
          status?: string | null
          summary?: Json | null
          sync_type?: string
          total_sam_calls?: number | null
        }
        Relationships: []
      }
      saved_documents: {
        Row: {
          content: string
          created_at: string
          document_type: string
          id: string
          opportunity_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          document_type: string
          id?: string
          opportunity_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          document_type?: string
          id?: string
          opportunity_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      share_notifications: {
        Row: {
          created_at: string | null
          from_user_id: string
          id: string
          is_read: boolean | null
          message: string | null
          share_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          from_user_id: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          share_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          from_user_id?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          share_type?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          opportunities_added: number | null
          opportunities_found: number | null
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          opportunities_added?: number | null
          opportunities_found?: number | null
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          opportunities_added?: number | null
          opportunities_found?: number | null
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      touchpoints: {
        Row: {
          contact_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          outcome: string | null
          related_id: string | null
          related_type: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          related_id?: string | null
          related_type?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          related_id?: string | null
          related_type?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "touchpoints_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      usaspending_sync_logs: {
        Row: {
          awards_fetched: number | null
          awards_inserted: number | null
          awards_updated: number | null
          completed_at: string | null
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          awards_fetched?: number | null
          awards_inserted?: number | null
          awards_updated?: number | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          awards_fetched?: number | null
          awards_inserted?: number | null
          awards_updated?: number | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_contract_watchlist: {
        Row: {
          contractor_name: string
          created_at: string | null
          id: string
          keywords: string[] | null
          notify_on_match: boolean | null
          user_id: string
        }
        Insert: {
          contractor_name: string
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          notify_on_match?: boolean | null
          user_id: string
        }
        Update: {
          contractor_name?: string
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          notify_on_match?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_data_shares: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          owner_user_id: string
          share_type: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          owner_user_id: string
          share_type: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          owner_user_id?: string
          share_type?: string
          shared_with_user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          use_trends_for_scoring: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          use_trends_for_scoring?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          use_trends_for_scoring?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string | null
          id: string
          opportunity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          opportunity_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_insights: {
        Row: {
          alerts: Json | null
          created_at: string | null
          id: string
          insights_text: string | null
          pipeline_health_score: number | null
          top_opportunities: string[] | null
          trends: Json | null
          user_id: string
          week_of: string
        }
        Insert: {
          alerts?: Json | null
          created_at?: string | null
          id?: string
          insights_text?: string | null
          pipeline_health_score?: number | null
          top_opportunities?: string[] | null
          trends?: Json | null
          user_id: string
          week_of: string
        }
        Update: {
          alerts?: Json | null
          created_at?: string | null
          id?: string
          insights_text?: string | null
          pipeline_health_score?: number | null
          top_opportunities?: string[] | null
          trends?: Json | null
          user_id?: string
          week_of?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          channel_id: string
          channel_name: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          resolved_channel_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          channel_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          resolved_channel_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          resolved_channel_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      youtube_knowledge: {
        Row: {
          best_practices: Json | null
          channel_id: string | null
          created_at: string | null
          description: string | null
          id: string
          key_themes: string[] | null
          published_at: string | null
          red_flags: Json | null
          relevance_score: number | null
          technical_approaches: Json | null
          transcript: string | null
          user_id: string
          video_id: string
          video_title: string
          video_url: string
          win_strategies: Json | null
        }
        Insert: {
          best_practices?: Json | null
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key_themes?: string[] | null
          published_at?: string | null
          red_flags?: Json | null
          relevance_score?: number | null
          technical_approaches?: Json | null
          transcript?: string | null
          user_id: string
          video_id: string
          video_title: string
          video_url: string
          win_strategies?: Json | null
        }
        Update: {
          best_practices?: Json | null
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key_themes?: string[] | null
          published_at?: string | null
          red_flags?: Json | null
          relevance_score?: number | null
          technical_approaches?: Json | null
          transcript?: string | null
          user_id?: string
          video_id?: string
          video_title?: string
          video_url?: string
          win_strategies?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_knowledge_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_sam_cache: { Args: never; Returns: number }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_access: {
        Args: {
          _owner_user_id: string
          _share_type: string
          _viewer_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
