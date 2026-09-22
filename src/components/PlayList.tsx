import { PlayMore } from "@/components/PlayMore";
import { PlayRow, type PlayView } from "@/components/PlayRow";

/**
 * A profile's plays. Only the rows on screen are drawn here; the rest comes
 * from /api/plays when the fold is opened.
 */

/** Rows shown before the rest fold away. */
const SHOWN = 8;

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
  const rest = plays.length - SHOWN;
  return (
    <div className="plays">
      {plays.slice(0, SHOWN).map((p) => (
        <PlayRow key={p.scoreId} play={p} />
      ))}
      {rest > 0 ? (
        <PlayMore userId={userId} list={list} count={rest} offset={SHOWN} />
      ) : null}
    </div>
  );
}
