import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

/**
 * Anyone's profile, by their osu! user ID, which is what leaderboards and map
 * pages link with. Opening your own lands on /me, where the popup lives.
 */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ osuUserId: string }>;
}) {
  const { osuUserId } = await params;
  const id = Number(osuUserId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [player] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.osuUserId, id), isNull(users.bannedAt)));
  if (!player) notFound();

  const session = await auth();
  if (session?.userId === player.id) redirect("/me");

  return <ProfileView userId={player.id} owner={false} />;
}
