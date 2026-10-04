import mongoose from "mongoose";

/**
 * Second, independent safety check: throws if the active Mongoose connection
 * is not a local in-memory instance. Call this before any bulk-delete test
 * cleanup, so that even if the primary safeguard (vitest.setup.ts stripping
 * MONGODB_URI) is ever bypassed or misconfigured, destructive cleanup code
 * still refuses to run against what looks like a real database.
 */
export function assertTestDatabase() {
  const host = mongoose.connection.host;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal) {
    throw new Error(
      `Refusing to run destructive test cleanup against non-local DB host "${host}". ` +
        "This looks like a real database connection, not the test in-memory server."
    );
  }
}
