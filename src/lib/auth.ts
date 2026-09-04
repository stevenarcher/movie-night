import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
      }
      return session;
    },
  },
});