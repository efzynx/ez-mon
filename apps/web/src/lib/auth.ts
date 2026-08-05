import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users, projects, eq } from "@ezmon/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        console.log(`[Auth] Attempting login for: ${email}`);

        const result = await db()
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const user = result[0];
        if (!user || !user.passwordHash) return null;

        const passwordMatch = await compare(password, user.passwordHash);
        console.log(`[Auth] Password match for ${email}: ${passwordMatch}`);
        
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "github") {
        if (!user.email) return false;

        const normalizedEmail = user.email.trim().toLowerCase();
        const database = db();

        const existing = await database
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (existing.length === 0) {
          const inserted = await database
            .insert(users)
            .values({
              email: normalizedEmail,
              name: user.name || normalizedEmail.split("@")[0],
              passwordHash: null,
            })
            .returning({ id: users.id });

          if (inserted[0]) {
            user.id = inserted[0].id;
            await database.insert(projects).values({
              userId: inserted[0].id,
              name: "Default Project",
              slug: "default-project",
              timezone: "UTC",
            });
          }
        } else {
          user.id = existing[0].id;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "github" && user.email) {
          const dbUser = await db()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, user.email.trim().toLowerCase()))
            .limit(1);
          if (dbUser[0]) {
            token.id = dbUser[0].id;
          }
        } else {
          token.id = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
