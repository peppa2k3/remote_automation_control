CREATE TYPE "DeviceRole" AS ENUM ('OPERATOR', 'VIEWER');
ALTER TABLE "devices" ADD COLUMN "ownerId" UUID, ADD COLUMN "runtime" JSONB;
UPDATE "devices" SET "ownerId" = (SELECT "id" FROM "users" WHERE "role" = 'OWNER' LIMIT 1);
ALTER TABLE "devices" ADD CONSTRAINT "devices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "devices_ownerId_idx" ON "devices"("ownerId");
CREATE TABLE "device_members" (
  "deviceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "DeviceRole" NOT NULL,
  CONSTRAINT "device_members_pkey" PRIMARY KEY ("deviceId", "userId"),
  CONSTRAINT "device_members_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "device_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "device_members_userId_idx" ON "device_members"("userId");
