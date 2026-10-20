import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { expect, it } from "vitest";

import * as schema from "./schema";

it("enables RLS on every one of the seventeen tables", () => {
  const tables = Object.values(schema).filter((value) => is(value, PgTable));
  expect(tables).toHaveLength(17);
  const withoutRls = tables
    .map((t) => getTableConfig(t))
    .filter((c) => !c.enableRLS);
  expect(withoutRls.map((c) => c.name)).toEqual([]);
});
