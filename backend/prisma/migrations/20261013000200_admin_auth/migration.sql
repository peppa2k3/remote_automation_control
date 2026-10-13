CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TABLE "users" (
  "id" UUID PRIMARY KEY, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'VIEWER', "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_one_owner" ON "users"("role") WHERE "role" = 'OWNER';
CREATE TABLE "auth_sessions" (
  "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" CHAR(64) NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL, "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE TABLE "auth_throttles" ("key" CHAR(64) PRIMARY KEY, "count" INTEGER NOT NULL, "resetAt" TIMESTAMPTZ(3) NOT NULL);
CREATE INDEX "auth_throttles_resetAt_idx" ON "auth_throttles"("resetAt");
CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY, "actorId" UUID, "action" TEXT NOT NULL, "targetId" UUID,
  "requestId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_createdAt_id_idx" ON "audit_logs"("createdAt", "id");
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");
