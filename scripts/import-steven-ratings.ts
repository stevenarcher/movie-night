import { PrismaClient } from "@prisma/client";
import { importRatingsForUser } from "./lib/import-ratings.ts";
import { DEFAULT_EMAIL } from "./lib/sheet.ts";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine */
}

const prisma = new PrismaClient();

/** Override the account to attach ratings to. Defaults to Steven's Google account. */
const DEFAULT_TARGET = { email: DEFAULT_EMAIL };

/** Target the account by email or by name (useful when the account has no email, e.g. OAuth-only). */
type Target = { email?: string; name?: string };

function parseTarget(): Target {
  const args = process.argv.slice(2);
  const flagEmail = args.find((a) => a.startsWith("--email="))?.slice("--email=".length);
  const flagName = args.find((a) => a.startsWith("--name="))?.slice("--name=".length);
  const envEmail = process.env.TARGET_EMAIL;
  const envName = process.env.TARGET_NAME;
  return {
    email: flagEmail ?? envEmail ?? (flagName ?? envName ? undefined : DEFAULT_TARGET.email),
    name: flagName ?? envName,
  };
}

async function main() {
  const target = parseTarget();

  const userByEmail = target.email
    ? await prisma.user.findUnique({ where: { email: target.email } })
    : null;
  const user =
    userByEmail ??
    (target.name
      ? await prisma.user.findFirst({ where: { name: { contains: target.name } } })
      : null);
  if (!user || !user.name) {
    console.error(`User not found (email: ${target.email ?? "—"}, name: ${target.name ?? "—"}).`);
    process.exit(1);
  }
  console.log(`Target user: ${user.name}${user.email ? ` (${user.email})` : ""} (role: ${user.role})`);

  const result = await importRatingsForUser(prisma, { id: user.id, name: user.name, email: user.email }, console.log);
  console.log(`\nDone! ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });