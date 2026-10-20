import { TEST_IDS } from "@/test/ghl-ids";

/*
 * assumed: what each of Lee's workflow webhooks posts, until one is pointed at a
 * preview (spec 06 open question 7). Shaped like GHL's standard workflow webhook
 * body (contact fields at the top, `calendar` on appointment triggers,
 * `customData` empty); only the paths in ASSUMED_PAYLOADS are read.
 */

const contact = (n: number, webhookId: string) => ({
  webhookId,
  contact_id: `hook-test-contact-${n}`,
  first_name: `Hook ${n}`,
  last_name: "Test",
  full_name: `Hook ${n} Test`,
  email: `hook-${n}@example.com`,
  phone: "+15555550100",
  tags: "",
  contact_source: "Get Started",
  date_created: "2026-10-20T14:00:00.000Z",
  location: { id: "loc-test", name: "Authority Solutions" },
  workflow: { id: "wf-test", name: "C1 Lead Ingestion Router" },
  customData: {},
});

export const contactCreated = (n = 1, webhookId = `wh-created-${n}`) =>
  contact(n, webhookId);

export const stageChanged = (n = 1, webhookId = `wh-stage-${n}`) => ({
  ...contact(n, webhookId),
  pipeline_id: TEST_IDS.pipelineId,
  pipeline_name: "New Lead Pipeline",
  pipleline_stage: "Qualified",
});

export const appointment = (
  n: number,
  webhookId: string,
  calendarId: string = TEST_IDS.calendars.discovery,
  status = "booked",
) => ({
  ...contact(n, webhookId),
  calendar: {
    id: calendarId,
    calendarName: "Discovery Session",
    appointmentId: `appt-${n}`,
    startTime: "2026-10-22T15:00:00-04:00",
    endTime: "2026-10-22T15:30:00-04:00",
    selectedTimezone: "America/New_York",
    status,
  },
});
