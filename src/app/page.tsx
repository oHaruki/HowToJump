import Link from "next/link";
import { getBankStats, getHardestEntry, getRecentEntries, getTierCounts } from "@/lib/queries";
import {
  LadderGrid, ModChip, NONE, Stat, TierChip, beatmapUrl,
} from "@/components/ui";
import { Cover } from "@/components/Cover";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [counts, stats, hardest, recent] = await Promise.all([
    getTierCounts(),
    getBankStats(),
    getHardestEntry(),
    getRecentEntries(4),
  ]);

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

        {hardest ? (
          <div className="box feat">
            <Cover
              setId={hardest.osuBeatmapsetId}
              kind="card"
              tierOrder={hardest.tierOrder}
              className="feat-art"
            />
            <div className="feat-body">
              <span className="lbl">Hardest on the ladder</span>
              <h3>
                <a
                  href={beatmapUrl(hardest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  {hardest.title}
                </a>
              </h3>
              <span className="t-diff">[{hardest.version}]</span>
              <div className="row-tight" style={{ marginTop: 2 }}>
                <TierChip tier={hardest.tierOrder} />
                <ModChip mod={hardest.mod} />
                <span className="chip">{hardest.category}</span>
              </div>
              <div className="statline">
                <span><i>Stars</i><b>{hardest.stars?.toFixed(2)}&#9733;</b></span>
                <span><i>BPM</i><b>{hardest.bpm != null ? Math.round(hardest.bpm) : NONE}</b></span>
                <span><i>Length</i><b>{hardest.drain || NONE}</b></span>
                <span><i>CS</i><b>{hardest.cs ?? NONE}</b></span>
                <span><i>AR</i><b>{hardest.ar ?? NONE}</b></span>
                <span><i>OD</i><b>{hardest.od ?? NONE}</b></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="box feat">
            <div className="feat-body">
              <span className="lbl">Nothing banked yet</span>
              <h3>The ladder is empty</h3>
              <p className="small">
                Staff add the first entries from the Add maps screen.
              </p>
            </div>
          </div>
        )}
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
                    <span className="chip">{m.category}</span>
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
