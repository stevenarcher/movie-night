import { PrismaClient } from "@prisma/client";
import { importRatingsForUser } from "./lib/import-ratings.ts";
import { DEFAULT_EMAIL } from "./lib/sheet.ts";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine */
}

const prisma = new PrismaClient();

/** Group members who haven't logged in yet — given a PENDING identity so their
 *  spreadsheet ratings can be imported and later claimed on first Google login. */
const PLACEHOLDER_NAMES = ["Charlie", "Kev", "Wan", "Jasper", "Cate", "Phil"];

async function main() {
  console.log("── Pending placeholder users ──");
  for (const name of PLACEHOLDER_NAMES) {
    const existing = await prisma.user.findFirst({ where: { name, role: "PENDING" } });
    if (existing) {
      console.log(`  = ${name} (already PENDING: ${existing.id})`);
      continue;
    }
    const created = await prisma.user.create({ data: { name, role: "PENDING" } });
    console.log(`  ＋ ${name} created (${created.id})`);
  }

  console.log("\n── Ratings import (per pending user) ──");
  const pending = await prisma.user.findMany({ where: { role: "PENDING" } });
  for (const user of pending) {
    if (!user.name) continue;
    console.log(`\n${user.name}:`);
    const result = await importRatingsForUser(prisma, { id: user.id, name: user.name, email: user.email }, console.log);
    console.log(`  ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped.`);
  }

  console.log("\n── Admin promotion (role moved to the DB) ──");
  const admin = await prisma.user.findUnique({ where: { email: DEFAULT_EMAIL } });
  if (admin) {
    await prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
    console.log(`  ${admin.name ?? DEFAULT_EMAIL} promoted to ADMIN.`);
  } else {
    console.log(`  ✗ no user with email ${DEFAULT_EMAIL} — set the role manually (ADMIN_GOOGLE_ID is gone).`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });