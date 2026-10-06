import { PlayMore } from "@/components/PlayMore";
import { PlayRow, type PlayView } from "@/components/PlayRow";

/**
 * A profile's plays under a row of column heads. Only the first rows are
 * drawn here; the rest come from /api/plays a page at a time. Top plays
 * carry their place in the list.
 */

/** Rows shown before the rest fold away. */
const SHOWN = 10;

export function PlayList({
  plays,
  empty,
  userId,
  list,
}: {
  plays: PlayView[];
  empty: string;
  /** Whose plays these are, for the fold to ask for the rest of them. */
  userId: number;
  list: "top" | "recent";
}) {
  if (!plays.length) return <p className="small">{empty}</p>;
  const ranked = list === "top";
  const rest = plays.length - SHOWN;
  return (
    <div className="plays" data-ranked={ranked || undefined}>
      <div className="play-cols" aria-hidden>
        {ranked ? <span>#</span> : null}
        <span className="c">Grade</span>
        <span>Map</span>
        <span className="c">Mods</span>
        <span className="c">Accuracy</span>
        <span className="c">Misses</span>
        <span className="r">EXP</span>
      </div>
      {plays.slice(0, SHOWN).map((p, i) => (
        <PlayRow key={p.scoreId} play={p} rank={ranked ? i + 1 : undefined} />
      ))}
      {rest > 0 ? (
        <PlayMore userId={userId} list={list} count={rest} offset={SHOWN} />
      ) : null}
    </div>
  );
}
