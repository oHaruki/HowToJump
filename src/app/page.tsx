import Link from "next/link";
import { getBankStats, getRecentEntries, getTierCounts } from "@/lib/queries";
import {
  CategoryChips, LadderGrid, ModChip, NONE, Stat, TierChip, beatmapUrl,
} from "@/components/ui";
import { Cover } from "@/components/Cover";
import { FeaturedRotator } from "@/components/FeaturedRotator";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [counts, stats, newest] = await Promise.all([
    getTierCounts(),
    getBankStats(),
    // Enough to be worth cycling, few enough that the dots stay usable.
    getRecentEntries(8),
  ]);
  const recent = newest.slice(0, 4);

  return (
    <div className="view">
      <div className="hero">
        <div className="hero-copy">
          {/* Decorative only, so it is hidden from assistive tech. */}
          <img
            className="hero-art"
            src="/hero-render.webp"
            alt=""
            aria-hidden="true"
            width={691}
            height={900}
          />
          <span className="lbl">osu! aim progression</span>
          <h1>Sixteen packs. Stone to GOAT.</h1>
          <p className="lede">
            A judged ladder through osu! aim. Every map belongs to exactly one pack
            under one mod, and every clear is graded on a single number: how many
            notes you dropped. Climb the ladder and watch your own progression fill
            itself in.
          </p>
          <div className="row" style={{ marginTop: 4 }}>
            <Link className="btn btn-primary" href="/ladder">
              See the ladder
            </Link>
            <Link className="btn" href="/maps">
              Browse the bank
            </Link>
          </div>
        </div>

        <FeaturedRotator entries={newest} />
      </div>

      <div className="stat-strip">
        <Stat label="packs" value={16} />
        <Stat label="grades" value={18} />
        <Stat label="entries on the ladder" value={stats.total} />
        <Stat
          label="hardest star rating"
          value={stats.hardest ? stats.hardest.toFixed(2) : "0.00"}
        />
      </div>

      <div className="stack-lg">
        <div className="section-head">
          <span className="lbl">The ladder</span>
          <h2>Difficulty you can actually feel</h2>
          <p className="lede">
            Each pack is one step up, placed by hand rather than by star rating
            alone. Stone is where everybody starts. GOAT is where almost nobody
            finishes.
          </p>
        </div>
        <LadderGrid counts={counts} />
      </div>

      {recent.length ? (
        <div className="stack-lg">
          <div className="section-head">
            <span className="lbl">On the ladder now</span>
            <h2>Recently judged</h2>
          </div>
          <div className="grid-auto">
            {recent.map((m) => (
              <div className="box feat" key={m.entryId}>
                <Cover
                  setId={m.osuBeatmapsetId}
                  kind="card"
                  tierOrder={m.tierOrder}
                  className="feat-art"
                />
                <div className="feat-body">
                  <div>
                    <a
                      className="t-title"
                      href={beatmapUrl(m)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.title}
                    </a>
                    <span className="t-diff">
                      {[m.version ? "[" + m.version + "]" : "", m.mapper]
                        .filter(Boolean)
                        .join("  " + NONE + "  ")}
                    </span>
                  </div>
                  <div className="row-tight">
                    <TierChip tier={m.tierOrder} />
                    <ModChip mod={m.mod} />
                    <CategoryChips categories={m.categories} />
                  </div>
                  <div className="statline">
                    <span><i>Stars</i><b>{m.stars?.toFixed(2)}&#9733;</b></span>
                    <span><i>BPM</i><b>{m.bpm != null ? Math.round(m.bpm) : NONE}</b></span>
                    <span><i>Length</i><b>{m.drain || NONE}</b></span>
                    <span><i>CS</i><b>{m.cs ?? NONE}</b></span>
                    <span><i>AR</i><b>{m.ar ?? NONE}</b></span>
                    <span><i>OD</i><b>{m.od ?? NONE}</b></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
