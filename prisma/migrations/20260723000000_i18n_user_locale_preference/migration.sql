-- CreateTable
CREATE TABLE "UserLocalePreference" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocalePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLocalePreference_clerkUserId_key" ON "UserLocalePreference"("clerkUserId");
