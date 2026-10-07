import { vi } from "vitest";

// Data-access functions read the request's cookies (the role preview, the
// viewer's time zone). Outside a request there are none, so every test gets
// the fake jar in src/test/server-fakes.ts, emptied by `resetFakes`.
vi.mock(
  "next/headers",
  async () => (await import("@/test/server-fakes")).headersModule,
);
