import { GET as getInvoice } from "@/app/api/leads/[leadId]/invoice/route";
import { POST as postGenerate } from "@/app/api/proposals/[leadId]/generate/route";
import {
  GET as getProposal,
  PUT as putProposal,
} from "@/app/api/proposals/[leadId]/route";
import { POST as postSend } from "@/app/api/proposals/[leadId]/send/route";
import { POST as postSimulate } from "@/app/api/proposals/[leadId]/simulate/route";
import { GET as getProposalLeads } from "@/app/api/proposals/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/proposals$/, getProposalLeads],
  ["GET", /^\/api\/proposals\/(?<leadId>[^/]+)$/, getProposal],
  ["PUT", /^\/api\/proposals\/(?<leadId>[^/]+)$/, putProposal],
  ["POST", /^\/api\/proposals\/(?<leadId>[^/]+)\/generate$/, postGenerate],
  ["POST", /^\/api\/proposals\/(?<leadId>[^/]+)\/send$/, postSend],
  ["POST", /^\/api\/proposals\/(?<leadId>[^/]+)\/simulate$/, postSimulate],
  ["GET", /^\/api\/leads\/(?<leadId>[^/]+)\/invoice$/, getInvoice],
];
