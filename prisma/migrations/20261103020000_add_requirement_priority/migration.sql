-- The requirement service has always written priority_tier/priority_until
-- (24h boost for premium buyers) but the columns never existed, so creating a
-- buyer request failed with HTTP 500. Additive and idempotent.
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "priority_tier" TEXT,
ADD COLUMN IF NOT EXISTS "priority_until" TIMESTAMP(3);
