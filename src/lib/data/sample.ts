/**
 * Drives the "Sample data" label and the role preview. False once the
 * data-access function bodies query the database (ADR-0006).
 */
export const SAMPLE_DATA = true;

// ponytail: one in-memory copy per server instance, on globalThis so Route
// Handlers and Server Components (separate bundles) share it. Not durable and
// not shared between instances; it disappears with the fixtures.
const holder = globalThis as { __dealwrightSample?: Map<string, unknown> };

/**
 * A named sample store for one data-access module: built from its fixtures on
 * first read, then changed in place by that module's writes. Returns the
 * function that reads it.
 */
export function sampleStore<T>(name: string, build: () => T): () => T {
  return () => {
    holder.__dealwrightSample ??= new Map();
    const stores = holder.__dealwrightSample;
    if (!stores.has(name)) stores.set(name, build());
    return stores.get(name) as T;
  };
}

/** Tests only: every sample store starts again from its fixtures. */
export function resetSampleData() {
  holder.__dealwrightSample = undefined;
}
