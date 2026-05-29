-- CreateTable
CREATE TABLE "GuestProfile" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "city" TEXT NOT NULL,
    "exp" TEXT NOT NULL DEFAULT 'beginner',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
