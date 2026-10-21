-- Case-insensitive email columns (user.email, invite.email).
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ORG_CREATED', 'ORG_UPDATED', 'ORG_STATUS_CHANGED', 'MEMBER_INVITED', 'INVITE_REVOKED', 'INVITE_ACCEPTED', 'MEMBER_ROLE_CHANGED', 'MEMBER_DEACTIVATED', 'MEMBER_REACTIVATED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'FLAG_CREATED', 'FLAG_UPDATED', 'FLAG_TOGGLED', 'FLAG_TARGETS_CHANGED', 'FLAG_DELETED');

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "org_id" UUID,
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "target_all" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "last_evaluated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_target" (
    "flag_id" UUID NOT NULL,
    "end_user_id" TEXT NOT NULL,
    "org_id" UUID NOT NULL,

    CONSTRAINT "flag_target_pkey" PRIMARY KEY ("flag_id","end_user_id")
);

-- CreateTable
CREATE TABLE "invite" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "org_id" UUID NOT NULL,
    "actor_id" UUID,
    "flag_id" UUID,
    "action" "AuditAction" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" INET,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_org_id_idx" ON "user"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_hash_key" ON "api_key"("key_hash");

-- CreateIndex
CREATE INDEX "api_key_org_id_idx" ON "api_key"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "flag_org_id_key_key" ON "flag"("org_id", "key");

-- CreateIndex
CREATE INDEX "flag_target_org_id_end_user_id_idx" ON "flag_target"("org_id", "end_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invite_token_hash_key" ON "invite"("token_hash");

-- CreateIndex
CREATE INDEX "invite_org_id_idx" ON "invite"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_refresh_token_hash_key" ON "session"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_org_id_created_at_idx" ON "audit_log"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_org_id_flag_id_idx" ON "audit_log"("org_id", "flag_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_target" ADD CONSTRAINT "flag_target_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "flag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_target" ADD CONSTRAINT "flag_target_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite" ADD CONSTRAINT "invite_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
