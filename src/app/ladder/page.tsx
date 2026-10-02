import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getSpecialPacks, getTierCounts } from "@/lib/queries";
import { LadderGrid, SectionHead, SpecialPackGrid } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Packs" };

export default async function LadderPage() {
  const [session, counts, special] = await Promise.all([auth(), getTierCounts(), getSpecialPacks()]);
  return (
    <div className="view">
      <SectionHead title="Packs" />
      <LadderGrid counts={counts} osuUserId={session?.osuUserId} />

      {special.length ? (
        <div className="stack-lg">
          <div className="section-head">
            <h2>Off the ladder</h2>
            <p className="lede">
              Their maps pay EXP like any other, but it counts on each pack&apos;s own
              board rather than toward your level.
            </p>
          </div>
          <SpecialPackGrid packs={special} />
        </div>
      ) : null}
    </div>
  );
}
