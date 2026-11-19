-- CreateTable
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL,
    "desktopImageUrl" TEXT NOT NULL,
    "desktopImageKey" TEXT NOT NULL,
    "mobileImageUrl" TEXT NOT NULL,
    "mobileImageKey" TEXT NOT NULL,
    "text" JSONB NOT NULL,
    "link" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeroSlide_isActive_displayOrder_idx" ON "HeroSlide"("isActive", "displayOrder");

