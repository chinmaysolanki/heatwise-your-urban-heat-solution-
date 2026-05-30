-- CreateTable
CREATE TABLE IF NOT EXISTS "GuestProfile" (
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "city" TEXT NOT NULL,
    "exp" TEXT NOT NULL DEFAULT 'beginner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestProfile_pkey" PRIMARY KEY ("email")
);
