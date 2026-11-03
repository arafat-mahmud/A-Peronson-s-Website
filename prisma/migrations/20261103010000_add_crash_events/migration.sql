-- Crash records written by server/utils/crashReporter.js (additive).
CREATE TABLE IF NOT EXISTS "crash_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fatal" BOOLEAN NOT NULL DEFAULT true,
    "error_name" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "stack" TEXT NOT NULL,
    "exit_code" INTEGER,
    "signal" TEXT,
    "environment" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "node_version" TEXT NOT NULL,
    "pid" INTEGER NOT NULL,
    "uptime_s" INTEGER NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crash_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crash_events_created_at_idx" ON "crash_events"("created_at");

CREATE INDEX IF NOT EXISTS "crash_events_type_created_at_idx" ON "crash_events"("type", "created_at");
