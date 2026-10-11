import type { CSSProperties } from "react";
import { signedExp, type ChangeView } from "@/lib/changes";
import { MAIN_LEVEL } from "@/lib/levels";
import { shortCategory, tierByOrder, tierFill } from "@/lib/tiers";
import { timeAgo } from "@/lib/time";

/** Up, down or level, for colouring a change of EXP. */
export const signOf = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

const packName = (order: number | null) => tierByOrder(order)?.name ?? "Unranked";

/**
 * One change to a player's levels: the packs the map moved between, the
 * map and what happened to it, and the EXP it made. `full` adds the levels
 * that changed pack, and says when in place of the EXP label.
 */
export function ChangeRow({ change: c, full }: { change: ChangeView; full?: boolean }) {
  const tier = tierByOrder(c.tier ? c.tier[1] : c.map?.tierOrder);
  const levels = c.levels
    .slice(0, 2)
    .map(
      (l) =>
        (l.scope === MAIN_LEVEL ? "Main level" : shortCategory(l.scope)) +
        " " + packName(l.from) + " → " + packName(l.to),
    );

  return (
    <div className="chg" style={{ "--tint": tier?.color ?? "#777" } as CSSProperties}>
      {c.map?.setId ? (
        <span className="chg-art" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={"https://assets.ppy.sh/beatmaps/" + c.map.setId + "/covers/card.jpg"}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : null}
      <Mark change={c} />
      <span className="chg-body">
        {c.map ? (
          <>
            <b>
              {c.map.title}
              {c.map.version ? <span> [{c.map.version}]</span> : null}
              {c.map.mod !== "NM" ? " +" + c.map.mod : null}
            </b>
            <span className="chg-what">{c.text}</span>
          </>
        ) : (
          <b>{c.text}</b>
        )}
        {full && levels.length ? <span className="chg-levels">{levels.join(" · ")}</span> : null}
      </span>
      <span className="chg-exp" data-sign={signOf(c.exp)}>
        {signedExp(c.exp)}
        <small>{full ? timeAgo(new Date(c.at)) : "EXP"}</small>
      </span>
    </div>
  );
}

/** The packs a map moved between, or the one it sits in. */
function Mark({ change: c }: { change: ChangeView }) {
  if (c.tier) {
    return (
      <span className="chg-mark" aria-hidden>
        <i style={{ background: tierFill(tierByOrder(c.tier[0])) }} />
        <svg className="chg-arrow" viewBox="0 0 8 12">
          <path d="M2 2l4 4-4 4" />
        </svg>
        <i style={{ background: tierFill(tierByOrder(c.tier[1])) }} />
      </span>
    );
  }
  const tier = tierByOrder(c.map?.tierOrder);
  return (
    <span className="chg-mark" aria-hidden>
      <i data-empty={tier ? undefined : true} style={tier ? { background: tierFill(tier) } : undefined} />
    </span>
  );
}
