import { vi } from "vitest";
import { POST as postLost } from "@/app/api/leads/[leadId]/lost/route";
import { POST as postQualification } from "@/app/api/leads/[leadId]/qualification/route";
import { POST as postReview } from "@/app/api/leads/[leadId]/review/route";
import { GET as getLead } from "@/app/api/leads/[leadId]/route";
import { POST as postSpam } from "@/app/api/leads/[leadId]/spam/route";
import { GET as getLeads } from "@/app/api/leads/route";
import { GET as getMe } from "@/app/api/me/route";
import { GET as getSummary } from "@/app/api/pipeline/summary/route";
import { POST as postViewerRole } from "@/app/api/viewer/role/route";
import { GET as getViewer } from "@/app/api/viewer/route";
import { Toaster } from "@/components/ui/toast";
import { listLeads, resetSampleLeads } from "@/lib/data/leads";
import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import { listLeadsQuerySchema } from "@/lib/leads/schemas";
import type { Role } from "@/lib/roles";
import { resetNavigation } from "@/test/navigation";
import { renderPage } from "@/test/render";
import { fake, resetFakes, signIn } from "@/test/server-fakes";

/*
 * Page-level helpers for the dashboard screens. A screen under test talks to
 * the real Route Handlers through a stubbed `fetch`, so a test exercises the
 * whole path (component, hook, handler, data access, sample store) with only
 * the two outer boundaries faked: Supabase Auth and the database. Test files
 * wire the fakes in with
 *   vi.mock("@/lib/supabase/server", async () => (await import("@/test/server-fakes")).supabaseServerModule);
 *   vi.mock("@/lib/prisma", async () => (await import("@/test/server-fakes")).prismaModule);
 *   vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationModule);
 */

const ORIGIN = "http://localhost:3000";
/** Noon UTC: "today" is the same day on whichever machine runs the tests. */
export const NOW = new Date("2026-10-07T12:00:00.000Z");
export const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};

// --- the API -----------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: each handler names its own params; the table only passes them through
type Handler = (request: Request, context: any) => Promise<Response>;

/** Route params are the path's named groups, e.g. `(?<leadId>[^/]+)`. */
const ROUTES: [method: string, path: RegExp, handler: Handler][] = [
  ["GET", /^\/api\/me$/, getMe],
  ["GET", /^\/api\/viewer$/, getViewer],
  ["POST", /^\/api\/viewer\/role$/, postViewerRole],
  ["GET", /^\/api\/leads$/, getLeads],
  ["GET", /^\/api\/pipeline\/summary$/, getSummary],
  ["GET", /^\/api\/leads\/(?<leadId>[^/]+)$/, getLead],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/review$/, postReview],
  [
    "POST",
    /^\/api\/leads\/(?<leadId>[^/]+)\/qualification$/,
    postQualification,
  ],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/lost$/, postLost],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/spam$/, postSpam],
];

type Override = {
  method: string;
  path: RegExp;
  once: boolean;
  respond: (request: Request) => Promise<Response> | Response;
};
let overrides: Override[] = [];

/** The real Route Handler for a request. */
async function route(request: Request) {
  const { pathname } = new URL(request.url);
  for (const [method, path, handler] of ROUTES) {
    const match = request.method === method && path.exec(pathname);
    if (match) {
      const params = Object.fromEntries(
        Object.entries(match.groups ?? {}).map(([name, value]) => [
          name,
          decodeURIComponent(value),
        ]),
      );
      return handler(request, { params: Promise.resolve(params) });
    }
  }
  return new Response(null, { status: 404 });
}

async function serve(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(new URL(String(input), ORIGIN), init);
  const { pathname } = new URL(request.url);
  const override = overrides.find(
    (candidate) =>
      candidate.method === request.method && candidate.path.test(pathname),
  );
  if (!override) return route(request);
  if (override.once) overrides = overrides.filter((o) => o !== override);
  return override.respond(request);
}

export const api = {
  /** Every request the screen made, as "METHOD /path?query". */
  calls: () =>
    vi
      .mocked(fetch)
      .mock.calls.map(
        ([input, init]) => `${init?.method ?? "GET"} ${String(input)}`,
      ),
  /** Makes matching requests answer with a status instead of reaching the handler. */
  fail(method: string, path: RegExp, status = 500, { once = false } = {}) {
    overrides.push({
      method,
      path,
      once,
      respond: () =>
        Response.json(
          { error: { code: status === 409 ? "conflict" : "server_error" } },
          { status },
        ),
    });
  },
  /**
   * Holds matching requests open. Calling the returned function lets them
   * through to the real handlers, and stops holding.
   */
  hold(method: string, path: RegExp) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held: Override = {
      method,
      path,
      once: false,
      respond: async (request) => {
        await gate;
        return route(request);
      },
    };
    overrides.push(held);
    return () => {
      overrides = overrides.filter((override) => override !== held);
      release();
    };
  },
  /** Removes every `fail` and `hold`. */
  restore() {
    overrides = [];
  },
};

/** Previews a role, as the "Viewing as" control would have left it. Call after `startDashboard`. */
export function viewAs(role: Role) {
  fake.cookies.set(PREVIEW_ROLE_COOKIE, role);
}

/** Call in `beforeEach`: a signed-in user with a profile, fresh sample leads, a clean address. */
export function startDashboard(at = "/dashboard") {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  resetFakes();
  resetSampleLeads();
  signIn();
  fake.users.set(ada.id, ada);
  overrides = [];
  resetNavigation(at);
  vi.stubGlobal("fetch", vi.fn(serve));
  // jsdom has no matchMedia; a wide screen that prefers light.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  sessionStorage.clear();
}

/** Call in `afterEach`. */
export function stopDashboard() {
  vi.unstubAllGlobals();
  vi.useRealTimers();
}

/** Renders a screen with the providers every dashboard page has. */
export function renderScreen(ui: React.ReactElement) {
  return renderPage(<Toaster>{ui}</Toaster>);
}

/** The id of the sample lead with this name, in whichever tab it sits. */
export async function leadIdOf(name: string) {
  for (const tab of ["open", "spam", "nurture", "lost"]) {
    const page = await listLeads(
      listLeadsQuerySchema.parse({ q: name, tab, limit: "100" }),
    );
    const lead = page.items.find((item) => item.name === name);
    if (lead) return lead.id;
  }
  throw new Error(`no sample lead called ${name}`);
}

/** Text that must never reach a rep: a CRM's or a service's brand, or the internal name. */
export const FORBIDDEN =
  /ASCRM|GoHighLevel|HighLevel|\bGHL\b|Zoho|HubSpot|Salesforce|Atomic Slides|Presenton|SmartPricingTable|Invoice Ninja|Generate presentation|Get proposal link/i;
