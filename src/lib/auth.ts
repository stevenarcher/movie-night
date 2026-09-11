import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { findPendingForLogin } from "@/lib/pending-match";
import type { User as DbUser } from "@prisma/client";

// Claim-on-login: the adapter's createUser runs before the Account/Session rows
// are linked, so returning a claimed PENDING user's id keeps this login attached
// to the identity that already carries the member's spreadsheet history — no FK
// moves needed. First name matching is prefix-tolerant ("Dip" ↔ "Dipesh").
const prismaAdapter = PrismaAdapter(prisma);

const adapter = {
  ...prismaAdapter,
  async createUser(data: AdapterUser): Promise<AdapterUser> {
    const account = {
      name: data.name ?? undefined,
      email: data.email ?? undefined,
      emailVerified: data.emailVerified ?? undefined,
      image: data.image ?? undefined,
    };
    const claimed = await findPendingForLogin(data.name ?? undefined);
    if (claimed) {
      // Claim atomically — updateMany fails to match if a concurrent login
      // already promoted the placeholder, in which case we fall through and
      // create a fresh MEMBER account.
      const takeover = await prisma.user.updateMany({
        where: { id: claimed.id, role: "PENDING" },
        data: { ...account, role: "MEMBER" },
      });
      if (takeover.count === 1) {
        return prisma.user.findUniqueOrThrow({
          where: { id: claimed.id },
        }) as unknown as AdapterUser;
      }
    }
    return prisma.user.create({ data: { ...account, role: "MEMBER" } }) as unknown as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { scope: "openid profile" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.id) return true;
      if (account.provider === "google") {
        await prisma.user
          .update({
            where: { id: user.id },
            data: { googleId: String(account.providerAccountId) },
          })
          .catch(() => {
            // first login may race the adapter's user creation
          });
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user && user.id) {
        session.user.id = user.id;
        session.user.role = (user as DbUser).role;
      }
      return session;
    },
  },
});