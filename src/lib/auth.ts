import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";
// Pulls the JWT module into the program so the augmentation below resolves.
import type {} from "next-auth/jwt";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { fetchMe, type OsuMe } from "@/lib/osu/client";

export type Role = "user" | "helper" | "admin";

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
    osuUserId: number;
    role: Role;
    osuAccessToken?: string;
    osuRefreshToken?: string;
    osuExpiresAt?: number;
  }
}

declare module "next-auth" {
  // These sit at the top level rather than under `user`, because next-auth
  // already declares `user: User` and redeclaring it collapses the field.
  interface Session {
    userId: number;
    osuUserId: number;
    role: Role;
    osuAccessToken?: string;
  }
}

/** The osu! OAuth provider. "identify" covers user ID, name, avatar and rank. */
const osu: OAuthConfig<OsuMe> = {
  id: "osu",
  name: "osu!",
  type: "oauth",
  authorization: {
    url: "https://osu.ppy.sh/oauth/authorize",
    params: { scope: "identify public", response_type: "code" },
  },
  token: "https://osu.ppy.sh/oauth/token",
  userinfo: "https://osu.ppy.sh/api/v2/me/osu",
  clientId: process.env.OSU_CLIENT_ID,
  clientSecret: process.env.OSU_CLIENT_SECRET,
  checks: ["state"],
  profile(profile) {
    return {
      id: String(profile.id),
      name: profile.username,
      email: null,
      image: profile.avatar_url,
    };
  },
};

const bootstrapAdmins = new Set(
  (process.env.BOOTSTRAP_ADMINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** Creates the local row on first sign in, refreshes the cached profile after. */
async function upsertUser(me: OsuMe): Promise<{ id: number; role: Role }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.osuUserId, me.id),
  });

  const patch = {
    username: me.username,
    avatarUrl: me.avatar_url,
    countryCode: me.country_code,
    globalRank: me.statistics?.global_rank ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(users).set(patch).where(eq(users.id, existing.id));
    return { id: existing.id, role: existing.role as Role };
  }

  const role: Role = bootstrapAdmins.has(String(me.id)) ? "admin" : "user";
  const [created] = await db
    .insert(users)
    .values({ osuUserId: me.id, role, ...patch })
    .returning({ id: users.id });
  return { id: created.id, role };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [osu],
  session: { strategy: "jwt" },
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async jwt({ token, account }) {
      // Only runs on sign in, when the account object is present.
      if (account?.access_token) {
        const me = await fetchMe(account.access_token);
        const local = await upsertUser(me);
        token.osuUserId = me.id;
        token.userId = local.id;
        token.role = local.role;
        token.osuAccessToken = account.access_token;
        token.osuRefreshToken = account.refresh_token;
        token.osuExpiresAt = account.expires_at;
        token.picture = me.avatar_url;
        token.name = me.username;
      }
      return token;
    },
    async session({ session, token }) {
      // Read from the database, not the token, so a role change applies at once.
      let role: Role = token.role ?? "user";
      if (token.userId) {
        const row = await db.query.users.findFirst({
          where: eq(users.id, token.userId),
          columns: { role: true, bannedAt: true },
        });
        if (row) role = row.bannedAt ? "user" : (row.role as Role);
      }

      // Returned as a new object rather than mutated: the callback's session
      // parameter is a union across session strategies, so writing to it is
      // rejected by the type checker.
      return {
        ...session,
        userId: token.userId,
        osuUserId: token.osuUserId,
        role,
        osuAccessToken: token.osuAccessToken,
      };
    },
  },
});

/* ------------------------------------------------------------ role guards */

export type CurrentUser = {
  id: number;
  osuUserId: number;
  role: Role;
  name: string | null;
  image: string | null;
};

export async function currentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session) return null;
  return {
    id: session.userId,
    osuUserId: session.osuUserId,
    role: session.role,
    name: session.user?.name ?? null,
    image: session.user?.image ?? null,
  };
}

export function isStaff(role: string | undefined | null): boolean {
  return role === "helper" || role === "admin";
}

/** Throws if the signed in user is not staff. Used by every staff action. */
export async function requireStaff() {
  const user = await currentUser();
  if (!user || !isStaff(user.role)) throw new Error("Staff access required");
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "admin") throw new Error("Admin access required");
  return user;
}
