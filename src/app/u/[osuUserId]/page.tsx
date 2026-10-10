import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userLevels, users } from "@/lib/schema";
import { MAIN_LEVEL } from "@/lib/levels";
import { snapshotOf } from "@/lib/progress";
import { SITE_NAME } from "@/lib/site";
import { categoryBySlug, categorySlug, tierByOrder } from "@/lib/tiers";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ osuUserId: string }>;
  searchParams: Promise<{ category?: string }>;
};

/** A player who is not banned, by osu! user ID, with their main level's pack. */
const findPlayer = cache(async (osuUserId: number) => {
  if (!Number.isSafeInteger(osuUserId) || osuUserId <= 0) return null;
  const [player] = await db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
    .from(users)
    .where(and(eq(users.osuUserId, osuUserId), isNull(users.bannedAt)));
  if (!player) return null;
  const levels = await db.select().from(userLevels).where(eq(userLevels.userId, player.id));
  return { ...player, tier: tierByOrder(snapshotOf(levels)[MAIN_LEVEL].tierOrder) };
});

async function playerFor({ params }: Props) {
  const { osuUserId } = await params;
  return findPlayer(Number(osuUserId));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const player = await playerFor(props);
  if (!player) return {};
  const description = player.tier
    ? player.username + " is at " + player.tier.name + " on " + SITE_NAME + "."
    : player.username + " on " + SITE_NAME + ".";

  return {
    title: player.username,
    description,
    openGraph: {
      siteName: SITE_NAME,
      title: player.username,
      description,
      images: player.avatarUrl ? [{ url: player.avatarUrl }] : undefined,
    },
  };
}

/** The main level's pack colour, which Discord uses for the embed's side stripe. */
export async function generateViewport(props: Props): Promise<Viewport> {
  const player = await playerFor(props);
  return player?.tier ? { themeColor: player.tier.color } : {};
}

/**
 * Anyone's profile, by their osu! user ID, which is what leaderboards and map
 * pages link with. Opening your own lands on /me, where the popup lives.
 */
export default async function PlayerPage(props: Props) {
  const player = await playerFor(props);
  if (!player) notFound();
  const category = categoryBySlug((await props.searchParams).category);

  const session = await auth();
  if (session?.userId === player.id) {
    redirect(category ? "/me?category=" + categorySlug(category) : "/me");
  }

  return <ProfileView userId={player.id} owner={false} category={category} />;
}
