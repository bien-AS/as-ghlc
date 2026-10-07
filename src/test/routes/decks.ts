import { GET as getDeckPdf } from "@/app/api/decks/[leadId]/pdf/route";
import { GET as getDeck } from "@/app/api/decks/[leadId]/route";
import { PATCH as patchSlide } from "@/app/api/decks/[leadId]/slides/[slideId]/route";
import { GET as getSlots } from "@/app/api/decks/[leadId]/slots/route";
import { POST as postTemplate } from "@/app/api/decks/[leadId]/template/route";
import { GET as getDecks } from "@/app/api/decks/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/decks$/, getDecks],
  ["GET", /^\/api\/decks\/(?<leadId>[^/]+)$/, getDeck],
  ["GET", /^\/api\/decks\/(?<leadId>[^/]+)\/slots$/, getSlots],
  ["GET", /^\/api\/decks\/(?<leadId>[^/]+)\/pdf$/, getDeckPdf],
  ["POST", /^\/api\/decks\/(?<leadId>[^/]+)\/template$/, postTemplate],
  [
    "PATCH",
    /^\/api\/decks\/(?<leadId>[^/]+)\/slides\/(?<slideId>[^/]+)$/,
    patchSlide,
  ],
];
