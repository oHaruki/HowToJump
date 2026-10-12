import type { Metadata } from "next";
import { auth, signIn } from "@/lib/auth";
import { getRecentEntries, type BankRow } from "@/lib/queries";
import { shortCategory } from "@/lib/tiers";
import { HowToPlay } from "@/components/HowToPlay";
import type { GuideMap } from "@/components/GuideScenes";

export const metadata: Metadata = {
  title: "How to play",
  description:
    "Sign in with osu!, pick a map from the bank, play it, and get EXP. The whole loop in four steps.",
};

export const dynamic = "force-dynamic";

const toGuideMap = (r: BankRow): GuideMap => ({
  osuBeatmapId: r.osuBeatmapId,
  setId: r.osuBeatmapsetId,
  title: r.title ?? "beatmap " + r.osuBeatmapId,
  version: r.version,
  mapper: r.mapper,
  mod: r.mod,
  tierOrder: r.tierOrder,
  stars: r.stars,
  skill: shortCategory(r.categories[0] ?? "Precision"),
});

/** The guide, its pictures drawn with the newest maps that have art. */
export default async function HowToPlayPage() {
  const [session, recent] = await Promise.all([auth(), getRecentEntries(12)]);
  const covered = recent.filter((r) => r.osuBeatmapsetId != null);
  return (
    <HowToPlay
      signedIn={Boolean(session?.userId)}
      maps={(covered.length ? covered : recent).slice(0, 3).map(toGuideMap)}
      signIn={async () => {
        "use server";
        await signIn("osu", { redirectTo: "/maps" });
      }}
    />
  );
}
