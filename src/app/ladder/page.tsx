import type { Metadata } from "next";
import { getSpecialPacks, getTierCounts } from "@/lib/queries";
import { LadderGrid, SectionHead, SpecialPackGrid } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Packs" };

export default async function LadderPage() {
  const [counts, special] = await Promise.all([getTierCounts(), getSpecialPacks()]);
  return (
    <div className="view">
      <SectionHead label="Packs" title="Packs" />
      <LadderGrid counts={counts} />

      {special.length ? (
        <div className="stack-lg">
          <div className="section-head">
            <span className="lbl">Special packs</span>
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
