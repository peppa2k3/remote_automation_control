-- Bootstrap integration table. Business schemas are introduced by their own prompts.
CREATE TABLE "SystemCheck" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "SystemCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemCheck_label_key" ON "SystemCheck"("label");
