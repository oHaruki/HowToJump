import Link from "next/link";
import { getBankStats, getHardestEntry, getRecentEntries, getTierCounts } from "@/lib/queries";
import { LadderGrid, MapCell, ModChip, Stat, TierChip, beatmapUrl } from "@/components/ui";

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
            {hardest.cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="feat-art" src={hardest.cardUrl} alt="" />
            ) : null}
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
                <span className="chip">{hardest.stars?.toFixed(2)}&#9733;</span>
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
                {m.cardUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="feat-art" src={m.cardUrl} alt="" loading="lazy" />
                ) : (
                  <div className="feat-art" style={{ background: "var(--bg-d)" }} />
                )}
                <div className="feat-body">
                  <MapCell map={m} />
                  <div className="row-tight">
                    <TierChip tier={m.tierOrder} />
                    <ModChip mod={m.mod} />
                    <span className="chip">{m.stars?.toFixed(2)}&#9733;</span>
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
