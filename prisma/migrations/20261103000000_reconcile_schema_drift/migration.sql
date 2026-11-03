-- Reconcile schema.prisma with the migration history.
--
-- Several models and columns were added to schema.prisma and applied to some
-- databases with `prisma db push`, never through a migration. Render only runs
-- `prisma migrate deploy`, so a database built from migrations alone was
-- missing them and every query touching those models failed with
-- "column/relation does not exist" (HTTP 500).
--
-- Every statement is idempotent (IF [NOT] EXISTS / guarded DO blocks), so this
-- migration is a no-op on a database that already received `db push`, and
-- repairs one that did not. It is purely additive: no table or column is
-- dropped and no row is touched.

DROP INDEX IF EXISTS "company_products_status_category_review_created_at_idx";

DROP INDEX IF EXISTS "feed_posts_status_created_at_idx";

DROP INDEX IF EXISTS "requirements_status_created_at_idx";

DROP INDEX IF EXISTS "social_interactions_entity_id_type_interaction_created_at_idx";

ALTER TABLE "company_products" ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "ai_analyzed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ai_auto_approved" BOOLEAN,
ADD COLUMN IF NOT EXISTS "ai_confidence" TEXT,
ADD COLUMN IF NOT EXISTS "ai_details" JSONB,
ADD COLUMN IF NOT EXISTS "ai_label" TEXT,
ADD COLUMN IF NOT EXISTS "ai_score" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "ai_signals" JSONB,
ADD COLUMN IF NOT EXISTS "ai_timing" JSONB,
ADD COLUMN IF NOT EXISTS "video_status" TEXT;
-- "ai_early_exit" keeps DEFAULT false: it is added by add_ai_severity_early_exit,
-- which sorts after every timestamped migration (fresh databases get it last).

ALTER TABLE "feed_posts" ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "link_previews" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "after_sales_support" INTEGER,
ADD COLUMN IF NOT EXISTS "communication_speed" INTEGER,
ADD COLUMN IF NOT EXISTS "delivery_timeliness" INTEGER,
ADD COLUMN IF NOT EXISTS "quality_control" INTEGER,
ADD COLUMN IF NOT EXISTS "sample_accuracy" INTEGER;

ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "sync_changes" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "scope" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entity_version" INTEGER NOT NULL,
    "content_hash" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "business_relationships" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "counterparty_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_relationships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "license_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "license_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploaded_file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "license_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "document_views" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "viewer_id" TEXT,
    "viewer_ip" TEXT,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "document_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "assistant_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "rule_key" TEXT NOT NULL,
    "name" TEXT,
    "pattern" TEXT,
    "response" TEXT,
    "conditions" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "assistant_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "assistant_config" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL DEFAULT 'default',
    "settings" JSONB,
    "prompt" TEXT,
    "model" TEXT,
    "temperature" DOUBLE PRECISION,
    "max_tokens" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "assistant_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_response_audit" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "user_id" TEXT,
    "session_id" TEXT,
    "query" TEXT NOT NULL,
    "response" TEXT,
    "model" TEXT,
    "tokens_used" INTEGER,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_response_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "admin_audit" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workflow_audit_logs" (
    "id" TEXT NOT NULL,
    "journey_id" TEXT NOT NULL,
    "transition_id" TEXT,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "category" TEXT,
    "assigned_to" TEXT,
    "assigned_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "esign_webhook_nonces" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esign_webhook_nonces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "email_outbox" (
    "id" TEXT NOT NULL,
    "to" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "html" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "source" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "order_type" TEXT NOT NULL DEFAULT 'MAIN',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "product_title" TEXT,
    "quantity" TEXT,
    "unit_price" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "total_amount" DOUBLE PRECISION,
    "description" TEXT,
    "specs" JSONB,
    "sample_request_id" TEXT,
    "parent_order_id" TEXT,
    "delivery_date" TIMESTAMP(3),
    "shipping_terms" TEXT,
    "payment_terms" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_changes_seq_key" ON "sync_changes"("seq");

CREATE INDEX IF NOT EXISTS "sync_changes_seq_idx" ON "sync_changes"("seq");

CREATE INDEX IF NOT EXISTS "sync_changes_entity_type_entity_id_idx" ON "sync_changes"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "business_relationships_buyer_id_counterparty_id_idx" ON "business_relationships"("buyer_id", "counterparty_id");

CREATE INDEX IF NOT EXISTS "business_relationships_buyer_id_idx" ON "business_relationships"("buyer_id");

CREATE INDEX IF NOT EXISTS "business_relationships_counterparty_id_idx" ON "business_relationships"("counterparty_id");

CREATE INDEX IF NOT EXISTS "license_requests_requester_id_idx" ON "license_requests"("requester_id");

CREATE INDEX IF NOT EXISTS "license_requests_recipient_id_status_idx" ON "license_requests"("recipient_id", "status");

CREATE INDEX IF NOT EXISTS "document_views_document_id_viewed_at_idx" ON "document_views"("document_id", "viewed_at");

CREATE UNIQUE INDEX IF NOT EXISTS "assistant_rules_rule_key_key" ON "assistant_rules"("rule_key");

CREATE INDEX IF NOT EXISTS "assistant_rules_org_id_idx" ON "assistant_rules"("org_id");

CREATE UNIQUE INDEX IF NOT EXISTS "assistant_config_org_id_key" ON "assistant_config"("org_id");

CREATE INDEX IF NOT EXISTS "ai_response_audit_org_id_created_at_idx" ON "ai_response_audit"("org_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_response_audit_user_id_created_at_idx" ON "ai_response_audit"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "admin_audit_admin_id_created_at_idx" ON "admin_audit"("admin_id", "created_at");

CREATE INDEX IF NOT EXISTS "admin_audit_entity_type_entity_id_idx" ON "admin_audit"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "admin_audit_admin_id_idx" ON "admin_audit"("admin_id");

CREATE INDEX IF NOT EXISTS "workflow_audit_logs_journey_id_created_at_idx" ON "workflow_audit_logs"("journey_id", "created_at");

CREATE INDEX IF NOT EXISTS "support_tickets_user_id_created_at_idx" ON "support_tickets"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "esign_webhook_nonces_nonce_key" ON "esign_webhook_nonces"("nonce");

CREATE INDEX IF NOT EXISTS "esign_webhook_nonces_created_at_idx" ON "esign_webhook_nonces"("created_at");

CREATE INDEX IF NOT EXISTS "email_outbox_status_created_at_idx" ON "email_outbox"("status", "created_at");

CREATE INDEX IF NOT EXISTS "email_logs_status_created_at_idx" ON "email_logs"("status", "created_at");

CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs"("to");

CREATE INDEX IF NOT EXISTS "orders_buyer_id_created_at_idx" ON "orders"("buyer_id", "created_at");

CREATE INDEX IF NOT EXISTS "orders_factory_id_created_at_idx" ON "orders"("factory_id", "created_at");

CREATE INDEX IF NOT EXISTS "orders_order_type_status_idx" ON "orders"("order_type", "status");

CREATE INDEX IF NOT EXISTS "analytics_actor_id_idx" ON "analytics"("actor_id");

CREATE INDEX IF NOT EXISTS "analytics_type_created_at_idx" ON "analytics"("type", "created_at");

CREATE INDEX IF NOT EXISTS "assistant_knowledge_org_id_idx" ON "assistant_knowledge"("org_id");

CREATE INDEX IF NOT EXISTS "boosts_user_id_idx" ON "boosts"("user_id");

CREATE INDEX IF NOT EXISTS "call_recording_views_call_id_idx" ON "call_recording_views"("call_id");

CREATE INDEX IF NOT EXISTS "call_recording_views_viewer_id_idx" ON "call_recording_views"("viewer_id");

CREATE INDEX IF NOT EXISTS "call_sessions_created_by_idx" ON "call_sessions"("created_by");

CREATE INDEX IF NOT EXISTS "call_sessions_match_id_idx" ON "call_sessions"("match_id");

CREATE INDEX IF NOT EXISTS "communication_limits_org_id_idx" ON "communication_limits"("org_id");

CREATE INDEX IF NOT EXISTS "communication_policy_configs_org_id_idx" ON "communication_policy_configs"("org_id");

CREATE INDEX IF NOT EXISTS "company_products_company_id_idx" ON "company_products"("company_id");

CREATE INDEX IF NOT EXISTS "company_products_status_category_content_review_status_crea_idx" ON "company_products"("status", "category", "content_review_status", "created_at");

CREATE INDEX IF NOT EXISTS "documents_uploaded_by_idx" ON "documents"("uploaded_by");

CREATE INDEX IF NOT EXISTS "documents_entity_type_entity_id_idx" ON "documents"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "feed_posts_user_id_idx" ON "feed_posts"("user_id");

CREATE INDEX IF NOT EXISTS "feed_posts_status_created_at_idx" ON "feed_posts"("status", "created_at");

CREATE INDEX IF NOT EXISTS "leads_counterparty_id_idx" ON "leads"("counterparty_id");

CREATE INDEX IF NOT EXISTS "message_policy_decisions_sender_id_idx" ON "message_policy_decisions"("sender_id");

CREATE INDEX IF NOT EXISTS "message_policy_decisions_match_id_idx" ON "message_policy_decisions"("match_id");

CREATE INDEX IF NOT EXISTS "message_policy_decisions_org_id_idx" ON "message_policy_decisions"("org_id");

CREATE INDEX IF NOT EXISTS "message_policy_logs_sender_id_idx" ON "message_policy_logs"("sender_id");

CREATE INDEX IF NOT EXISTS "message_policy_logs_match_id_idx" ON "message_policy_logs"("match_id");

CREATE INDEX IF NOT EXISTS "message_policy_logs_org_id_idx" ON "message_policy_logs"("org_id");

CREATE INDEX IF NOT EXISTS "message_queue_sender_id_idx" ON "message_queue"("sender_id");

CREATE INDEX IF NOT EXISTS "message_queue_match_id_idx" ON "message_queue"("match_id");

CREATE INDEX IF NOT EXISTS "message_queue_org_id_idx" ON "message_queue"("org_id");

CREATE INDEX IF NOT EXISTS "message_queue_items_sender_id_idx" ON "message_queue_items"("sender_id");

CREATE INDEX IF NOT EXISTS "message_queue_items_match_id_idx" ON "message_queue_items"("match_id");

CREATE INDEX IF NOT EXISTS "message_queue_items_org_id_idx" ON "message_queue_items"("org_id");

CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages"("sender_id");

CREATE INDEX IF NOT EXISTS "messages_match_id_idx" ON "messages"("match_id");

CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");

CREATE INDEX IF NOT EXISTS "partner_requests_requester_id_idx" ON "partner_requests"("requester_id");

CREATE INDEX IF NOT EXISTS "partner_requests_target_id_idx" ON "partner_requests"("target_id");

CREATE INDEX IF NOT EXISTS "product_views_user_id_idx" ON "product_views"("user_id");

CREATE INDEX IF NOT EXISTS "product_views_product_id_idx" ON "product_views"("product_id");

CREATE INDEX IF NOT EXISTS "ratings_from_user_id_idx" ON "ratings"("from_user_id");

CREATE INDEX IF NOT EXISTS "reports_actor_id_idx" ON "reports"("actor_id");

CREATE INDEX IF NOT EXISTS "reports_resolved_by_idx" ON "reports"("resolved_by");

CREATE INDEX IF NOT EXISTS "requirements_buyer_id_idx" ON "requirements"("buyer_id");

CREATE INDEX IF NOT EXISTS "requirements_assigned_agent_id_idx" ON "requirements"("assigned_agent_id");

CREATE INDEX IF NOT EXISTS "requirements_status_created_at_idx" ON "requirements"("status", "created_at");

CREATE INDEX IF NOT EXISTS "search_alerts_user_id_idx" ON "search_alerts"("user_id");

CREATE INDEX IF NOT EXISTS "social_interactions_entity_id_entity_type_interaction_type__idx" ON "social_interactions"("entity_id", "entity_type", "interaction_type", "created_at");

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");

CREATE INDEX IF NOT EXISTS "user_connections_requester_id_idx" ON "user_connections"("requester_id");

CREATE INDEX IF NOT EXISTS "user_connections_receiver_id_idx" ON "user_connections"("receiver_id");

CREATE INDEX IF NOT EXISTS "violations_actor_id_created_at_idx" ON "violations"("actor_id", "created_at");

CREATE INDEX IF NOT EXISTS "wallet_history_user_id_created_at_idx" ON "wallet_history"("user_id", "created_at");

DO $$
BEGIN
  IF to_regclass('"boosts_scope_status_starts_ends_idx"') IS NOT NULL AND to_regclass('"boosts_scope_status_starts_at_ends_at_idx"') IS NULL THEN
    ALTER INDEX "boosts_scope_status_starts_ends_idx" RENAME TO "boosts_scope_status_starts_at_ends_at_idx";
  END IF;
END $$;

