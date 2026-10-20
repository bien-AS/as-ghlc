CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "provider" NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"verified" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_event_id_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- The Lead Status picklist (opportunity.lead_status), read from production GHL on 2026-10-20, in picklist order.
-- group_name is each value's prefix: GHL's seven groups (New, Engaging, Appointment, Qualified, Nurturing, Won, Lost).
-- ASSUMED until spec 14 settles them (editable in /admin/statuses): `stages` and `tone` per group; threshold_days unset.
INSERT INTO "status_defs" ("value", "group_name", "position", "stages", "tone") VALUES
	('New - Contacted', 'New', 0, ARRAY['New Lead']::"lead_stage"[], 'neutral'),
	('New - Uncontacted', 'New', 1, ARRAY['New Lead']::"lead_stage"[], 'neutral'),
	('Engaging - Welcome Sequence', 'Engaging', 2, ARRAY['New Lead']::"lead_stage"[], 'brand'),
	('Engaging - Responded', 'Engaging', 3, ARRAY['New Lead']::"lead_stage"[], 'brand'),
	('Engaging - Hot Lead', 'Engaging', 4, ARRAY['New Lead']::"lead_stage"[], 'brand'),
	('Appointment - Scheduled', 'Appointment', 5, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Appointment - Awaiting Confirmation', 'Appointment', 6, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Appointment - Confirmed', 'Appointment', 7, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Appointment - Completed', 'Appointment', 8, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Appointment - No Show', 'Appointment', 9, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Appointment - Rescheduled', 'Appointment', 10, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Appointment - Cancelled', 'Appointment', 11, ARRAY['Discovery Call Booked', 'Proposal Review Booked']::"lead_stage"[], 'brand'),
	('Qualified - Pending Proposal', 'Qualified', 12, ARRAY['Qualified', 'Proposal Review Booked', 'Proposal Sent']::"lead_stage"[], 'ok'),
	('Qualified - Proposal Sent', 'Qualified', 13, ARRAY['Qualified', 'Proposal Review Booked', 'Proposal Sent']::"lead_stage"[], 'ok'),
	('Qualified - Negotiating', 'Qualified', 14, ARRAY['Qualified', 'Proposal Review Booked', 'Proposal Sent']::"lead_stage"[], 'ok'),
	('Nurturing - Long Term', 'Nurturing', 15, ARRAY['Nurturing']::"lead_stage"[], 'warn'),
	('Nurturing - Passive', 'Nurturing', 16, ARRAY['Nurturing']::"lead_stage"[], 'warn'),
	('Nurturing - Re-engaged', 'Nurturing', 17, ARRAY['Nurturing']::"lead_stage"[], 'warn'),
	('Won - Customer', 'Won', 18, ARRAY['Lead Won']::"lead_stage"[], 'ok'),
	('Lost - Not Qualified', 'Lost', 19, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - No Response', 'Lost', 20, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - Unsubscribed', 'Lost', 21, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - Competitor', 'Lost', 22, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - Cancelled No Reschedule', 'Lost', 23, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - No Decision', 'Lost', 24, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - Proposal No Win', 'Lost', 25, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - Spam', 'Lost', 26, ARRAY['Lead Lost']::"lead_stage"[], 'crit'),
	('Lost - Other', 'Lost', 27, ARRAY['Lead Lost']::"lead_stage"[], 'crit')
ON CONFLICT ("value") DO NOTHING;
