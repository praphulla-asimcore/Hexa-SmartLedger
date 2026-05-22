import { config } from "dotenv";
import { expand } from "dotenv-expand";
expand(config({ path: ".env.local" }));

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const email    = process.env.ADMIN_EMAIL    || "admin@hexamatics.com";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name     = process.env.ADMIN_NAME     || "Admin";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.user.create({ data: { email, password: hashed, name, role: "admin" } });
  console.log(`✓ Admin user created: ${email}`);
  console.log(`  Password: ${password}`);
  console.log("  IMPORTANT: Change this password immediately after first login.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
