CREATE TYPE "public"."booking_kind" AS ENUM('discovery', 'proposal_review');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked', 'showed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deck_group" AS ENUM('discovery_call', 'follow_up', 'strategy_session');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('one_time', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'flagged', 'sent', 'viewed', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('New Lead', 'Discovery Call Booked', 'Qualified', 'Proposal Review Booked', 'Proposal Sent', 'Lead Won', 'Lead Lost', 'Nurturing');--> statement-breakpoint
CREATE TYPE "public"."match_state" AS ENUM('matched', 'unmatched', 'not_sales_call');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('suspect_to_review', 'call_without_deck', 'recording_matched', 'recording_unmatched', 'proposal_viewed', 'proposal_signed', 'invoice_pair_ready', 'ghl_write_failed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('generating', 'draft', 'sent', 'viewed', 'signed', 'withdrawn', 'lost', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('ghl', 'presenton', 'smart_pricing_table', 'invoice_ninja', 'fathom', 'openrouter');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'rep');--> statement-breakpoint
CREATE TYPE "public"."status_actor" AS ENUM('webhook', 'reconcile', 'import', 'user');--> statement-breakpoint
CREATE TYPE "public"."validation_source" AS ENUM('rule', 'model', 'human');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('valid', 'suspect', 'spam');--> statement-breakpoint
CREATE TYPE "public"."write_result" AS ENUM('pending', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."write_type" AS ENUM('w1_verdict', 'w2_deck_link', 'w3_qualification', 'w4_mark_spam', 'w5_proposal_sent', 'w6_proposal_signed');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deck_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group" "deck_group" NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_templates_group_version_unique" UNIQUE("group","version")
);
--> statement-breakpoint
ALTER TABLE "deck_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"status" "job_status" NOT NULL,
	"presenton_task_id" text,
	"presenton_presentation_id" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"pdf_path" text,
	"slides_path" text,
	"error" text,
	"share_token" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "decks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ghl_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"write_type" "write_type" NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"result" "write_result" DEFAULT 'pending' NOT NULL,
	"response" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ghl_sync_log_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "ghl_sync_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"provider" "provider" PRIMARY KEY NOT NULL,
	"config" jsonb,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"kind" "invoice_kind" NOT NULL,
	"status" "invoice_status" NOT NULL,
	"invoice_ninja_id" text,
	"amount" numeric(12, 2),
	"line_items" jsonb,
	"due_on" date,
	"starts_on" date,
	"note" text,
	"error" text,
	"approved_by" uuid,
	"events" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_ninja_id_unique" UNIQUE("invoice_ninja_id"),
	CONSTRAINT "invoices_proposal_id_kind_unique" UNIQUE("proposal_id","kind")
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_research" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'generating' NOT NULL,
	"brief_md" text,
	"facts" jsonb,
	"error" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_research" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_stage" "lead_stage",
	"to_stage" "lead_stage",
	"from_status" text,
	"to_status" text,
	"actor" "status_actor" NOT NULL,
	"actor_id" uuid,
	"sync_log_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_status_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ghl_contact_id" text NOT NULL,
	"ghl_opportunity_id" text,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"lead_source" text,
	"form_answers" jsonb,
	"stage" "lead_stage",
	"lead_status" text,
	"verdict" "verdict",
	"assigned_to" uuid,
	"ghl_assigned_user_id" text,
	"discovery_booking_at" timestamp with time zone,
	"discovery_booking_status" "booking_status",
	"review_booking_at" timestamp with time zone,
	"review_booking_status" "booking_status",
	"last_activity_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_ghl_contact_id_unique" UNIQUE("ghl_contact_id"),
	CONSTRAINT "leads_ghl_opportunity_id_unique" UNIQUE("ghl_opportunity_id")
);
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fathom_recording_id" text NOT NULL,
	"title" text,
	"recorded_by_email" text,
	"share_url" text,
	"scheduled_start_at" timestamp with time zone,
	"recording_started_at" timestamp with time zone,
	"recording_ended_at" timestamp with time zone,
	"invitees" jsonb,
	"summary_md" text,
	"action_items" jsonb,
	"lead_id" uuid,
	"booking_kind" "booking_kind",
	"match_state" "match_state" DEFAULT 'unmatched' NOT NULL,
	"match_rule" text,
	"match_evidence" jsonb,
	"matched_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_fathom_recording_id_unique" UNIQUE("fathom_recording_id"),
	CONSTRAINT "meetings_matched_has_lead" CHECK ("meetings"."match_state" <> 'matched' or "meetings"."lead_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"lead_id" uuid,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "role" DEFAULT 'rep' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"ghl_user_id" text,
	"first_run" boolean DEFAULT true NOT NULL,
	"celebration_shown" boolean DEFAULT false NOT NULL,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_ghl_user_id_unique" UNIQUE("ghl_user_id"),
	CONSTRAINT "profiles_email_lowercase" CHECK ("profiles"."email" = lower("profiles"."email"))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "proposal_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"prompt" text,
	"diff" jsonb,
	"applied_by" uuid,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_revisions_proposal_id_revision_unique" UNIQUE("proposal_id","revision")
);
--> statement-breakpoint
ALTER TABLE "proposal_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"transcript_id" uuid,
	"status" "proposal_status" NOT NULL,
	"spt_proposal_id" text,
	"client_url" text,
	"extracted_values" jsonb,
	"line_items" jsonb,
	"value" numeric(12, 2),
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"error" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_spt_proposal_id_unique" UNIQUE("spt_proposal_id")
);
--> statement-breakpoint
ALTER TABLE "proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "status_defs" (
	"value" text PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"position" integer NOT NULL,
	"stages" "lead_stage"[] NOT NULL,
	"tone" text NOT NULL,
	"threshold_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_defs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"lead_id" uuid,
	"turns" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcripts_meeting_id_unique" UNIQUE("meeting_id"),
	CONSTRAINT "transcripts_meeting_or_lead" CHECK (num_nonnulls("transcripts"."meeting_id", "transcripts"."lead_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "transcripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"source" "validation_source" NOT NULL,
	"verdict" "verdict" NOT NULL,
	"confidence" numeric(4, 3),
	"patterns" text[],
	"reasons" text[],
	"summary" text,
	"inputs" jsonb,
	"overridden_by" uuid,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_runs_override_is_human" CHECK (("validation_runs"."source" = 'human') = ("validation_runs"."overridden_by" is not null))
);
--> statement-breakpoint
ALTER TABLE "validation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_template_id_deck_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."deck_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghl_sync_log" ADD CONSTRAINT "ghl_sync_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_research" ADD CONSTRAINT "lead_research_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_events" ADD CONSTRAINT "lead_status_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_events" ADD CONSTRAINT "lead_status_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_events" ADD CONSTRAINT "lead_status_events_sync_log_id_ghl_sync_log_id_fk" FOREIGN KEY ("sync_log_id") REFERENCES "public"."ghl_sync_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_lead_status_status_defs_value_fk" FOREIGN KEY ("lead_status") REFERENCES "public"."status_defs"("value") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_matched_by_profiles_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_revisions" ADD CONSTRAINT "proposal_revisions_applied_by_profiles_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_overridden_by_profiles_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_templates_group_index" ON "deck_templates" USING btree ("group") WHERE "deck_templates"."active";--> statement-breakpoint
CREATE INDEX "decks_lead_id_created_at_index" ON "decks" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ghl_sync_log_lead_id_index" ON "ghl_sync_log" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_research_lead_id_created_at_index" ON "lead_research" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lead_status_events_lead_id_created_at_index" ON "lead_status_events" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_assigned_to_index" ON "leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "meetings_lead_id_created_at_index" ON "meetings" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_profile_id_created_at_index" ON "notifications" USING btree ("profile_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "proposals_lead_id_created_at_index" ON "proposals" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transcripts_lead_id_created_at_index" ON "transcripts" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "validation_runs_lead_id_created_at_index" ON "validation_runs" USING btree ("lead_id","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Hand-written: validation_runs and lead_status_events are append-only (spec 01 section 4 rule 4). DELETE stays open.
CREATE FUNCTION "public"."reject_update"() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "validation_runs_append_only" BEFORE UPDATE ON "validation_runs" FOR EACH ROW EXECUTE FUNCTION "public"."reject_update"();--> statement-breakpoint
CREATE TRIGGER "lead_status_events_append_only" BEFORE UPDATE ON "lead_status_events" FOR EACH ROW EXECUTE FUNCTION "public"."reject_update"();