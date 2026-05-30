-- Add emailVerified to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Create EmailOtp table
CREATE TABLE IF NOT EXISTS "EmailOtp" (
    "id"         TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "codeHash"   TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "attempts"   INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailOtp_email_key" ON "EmailOtp"("email");
