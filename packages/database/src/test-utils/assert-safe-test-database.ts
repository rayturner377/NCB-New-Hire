/**
 * Pure check, kept separate from the throwing setup() below so it's directly unit-testable: does
 * this DATABASE_URL point at something that looks like a disposable test database?
 */
export function isDatabaseNameSafeForDestructiveTests(databaseUrl: string | undefined): boolean {
  const withoutQuery = (databaseUrl ?? '').split('?')[0] ?? '';
  const databaseName = withoutQuery.split('/').pop() ?? '';
  return /test/i.test(databaseName);
}

/**
 * Vitest globalSetup for vitest.integration.config.ts — runs once, before any integration test
 * file, in every environment that runs them (a developer's machine, CI). Integration tests exist
 * specifically to exercise real destructive operations (audit.integration.test.ts's deleteMany()
 * calls, and whatever future integration tests add) against a real Postgres instance, which is only
 * safe when that instance is a disposable one, never dev or production data.
 *
 * That safety used to rest entirely on a doc comment saying "requires DATABASE_URL to point at
 * ncb_medical_test, not dev data" — which a human (in this project's own history, 2026-09) missed
 * once, ran the suite against real dev data, and permanently lost every audit_events row that
 * existed before that run. This makes the same rule impossible to miss by turning it into a thrown
 * error instead of a comment, while still allowing a genuinely deliberate override.
 */
export default function setup(): void {
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS === 'true') {
    return;
  }

  if (!isDatabaseNameSafeForDestructiveTests(process.env.DATABASE_URL)) {
    const databaseName = (process.env.DATABASE_URL ?? '').split('?')[0]?.split('/').pop() || '(none)';
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL points at database "${databaseName}", which doesn't look ` +
        'like a disposable test database (expected its name to contain "test", e.g. "ncb_medical_test"). ' +
        'Integration tests run real destructive operations (e.g. deleteMany()) and must never run against dev or ' +
        'production data. If you genuinely mean to run them against this database on purpose, set ' +
        'ALLOW_DESTRUCTIVE_DB_TESTS=true explicitly.'
    );
  }
}
