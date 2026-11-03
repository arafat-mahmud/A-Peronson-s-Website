-- Production applied the original 20261103000000_reconcile_schema_drift, which
-- dropped this default; schema.prisma declares @default(false). The column is
-- created by add_ai_severity_early_exit, which sorts after every timestamped
-- migration, so on an empty database it does not exist yet: guard the ALTER.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'documents' AND column_name = 'ai_early_exit'
  ) THEN
    ALTER TABLE "documents" ALTER COLUMN "ai_early_exit" SET DEFAULT false;
  END IF;
END $$;
