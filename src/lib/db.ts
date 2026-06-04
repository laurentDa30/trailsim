import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db"
  // Strip "file:" prefix for better-sqlite3
  const dbPath = dbUrl.startsWith("file:")
    ? path.resolve(process.cwd(), dbUrl.slice("file:".length))
    : dbUrl
  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  return new PrismaClient({ adapter })
}

const db = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalThis.prisma = db

export default db
