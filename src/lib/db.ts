import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const db = globalThis.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalThis.prisma = db

export default db
