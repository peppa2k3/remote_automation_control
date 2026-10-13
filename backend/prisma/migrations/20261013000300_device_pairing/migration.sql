CREATE TABLE "pairing_codes" (
  "id" UUID PRIMARY KEY, "codeHash" CHAR(64) NOT NULL UNIQUE,
  "createdBy" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "usedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pairing_codes_expiresAt_idx" ON "pairing_codes"("expiresAt");
CREATE TABLE "devices" (
  "id" UUID PRIMARY KEY, "label" TEXT NOT NULL, "platform" TEXT NOT NULL,
  "arch" TEXT NOT NULL, "version" TEXT NOT NULL, "capabilities" TEXT[] NOT NULL,
  "lastSeenAt" TIMESTAMPTZ(3), "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "devices_lastSeenAt_idx" ON "devices"("lastSeenAt");
CREATE TABLE "device_credentials" (
  "id" UUID PRIMARY KEY, "deviceId" UUID NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  "tokenHash" CHAR(64) NOT NULL UNIQUE, "scopes" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "activatedAt" TIMESTAMPTZ(3),
  "pendingExpiresAt" TIMESTAMPTZ(3), "rotationParentId" UUID UNIQUE,
  "revokedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "device_credentials_deviceId_revokedAt_idx" ON "device_credentials"("deviceId", "revokedAt");
CREATE INDEX "device_credentials_expiresAt_idx" ON "device_credentials"("expiresAt");
