-- Add emailVerified to User
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Create EmailOtp table
CREATE TABLE "EmailOtp" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "email"      TEXT NOT NULL,
    "codeHash"   TEXT NOT NULL,
    "expiresAt"  DATETIME NOT NULL,
    "attempts"   INTEGER NOT NULL DEFAULT 0,
    "consumedAt" DATETIME,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL
);

CREATE UNIQUE INDEX "EmailOtp_email_key" ON "EmailOtp"("email");
