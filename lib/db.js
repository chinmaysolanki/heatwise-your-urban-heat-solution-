import { PrismaClient } from "@prisma/client";

const globalForPrisma = global;

function makePrismaClient() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) {
    // No DATABASE_URL — return a proxy that throws a clear error instead of
    // Prisma's cryptic "Environment variable not found" crash.
    return new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then" || prop === Symbol.toPrimitive) return undefined;
          throw new Error(
            `[HeatWise] Database not configured: DATABASE_URL is missing. ` +
            `Add a PostgreSQL connection string to your environment variables.`
          );
        },
      }
    );
  }
  return new PrismaClient();
}

export const db = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
