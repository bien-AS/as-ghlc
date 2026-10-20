/** A complete GHL_IDS for a made-up location. */
export const TEST_IDS = {
  pipelineId: "pipe",
  stages: {
    "New Lead": "s-new",
    "Discovery Call Booked": "s-dcb",
    Qualified: "s-qual",
    "Proposal Review Booked": "s-prb",
    "Proposal Sent": "s-sent",
    "Lead Won": "s-won",
    "Lead Lost": "s-lost",
    Nurturing: "s-nurt",
  },
  contactFields: Object.fromEntries(
    [
      "validation_status",
      "validation_summary",
      "ds_deck_link",
      "lead_source",
      "source_form_id",
      "ingestion_completed",
      "data_quality",
      "last_engagement",
      "engagement_count",
    ].map((key) => [key, `cf-${key}`]),
  ),
  opportunityFields: Object.fromEntries(
    [
      "lead_status",
      "qualification_decision",
      "appointment_status",
      "proposal_review_session",
    ].map((key) => [key, `of-${key}`]),
  ),
  calendars: { discovery: "cal-ds", proposalReview: "cal-pr" },
  placeholderUserId: "user-placeholder",
};
