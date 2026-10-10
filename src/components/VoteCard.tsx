"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleStay, spotlightEntry, unspotlightEntry, voteStay } from "@/lib/actions";
import { deletedPackName } from "@/lib/packs";
import type { BankRow, Spotlight } from "@/lib/queries";
import { tierByOrder } from "@/lib/tiers";
import { stayLean, votedPack, withStay, type StayTally, type VoteTally } from "@/lib/votes";
import { MapCard, PackTile } from "@/components/MapCard";
import { CategoryChips, ModIcons, SpecialChip, mapHref } from "@/components/ui";

type Mode = null | "spotlight" | "stay" | "remove";

/**
 * One map on the votes page: the map as the bank shows it, and a strip under
 * it with what players think of its pack, who voted Stay or Delete, and the
 * pin and close controls for those who may use them.
 */
export function VoteCard({
  map,
  tally,
  players,
  me,
  spotlight,
  may,
  focus,
}: {
  map: BankRow;
  tally: StayTally;
  players: VoteTally;
  /** The viewer's name as it shows among the voters. */
  me: string;
  spotlight?: Spotlight;
  may: { spotlight: boolean; settle: boolean };
  /** Outlines the card, for the map the page was opened on. */
  focus?: boolean;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(tally);
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [why, setWhy] = useState(spotlight?.note ?? "");
  const [pending, start] = useTransition();
  const tier = tierByOrder(map.tierOrder);
  const pack = tier?.name ?? "this pack";
  const deletedPack = tier ? deletedPackName(tier) : "its Deleted pack";
  const lean = stayLean(shown);

  function cast(vote: boolean) {
    if (pending) return;
    const next = shown.mine === vote ? null : vote;
    const before = shown;
    setShown(withStay(shown, next, me));
    setNote(null);
    start(async () => {
      try {
        const res = await voteStay(map.entryId, next);
        setShown(res.error ? before : res.tally);
        if (res.error) setNote(res.error);
      } catch {
        setShown(before);
        setNote("Vote failed, try again");
      }
    });
  }

  function run(fn: () => Promise<{ error?: string } | void>) {
    setNote(null);
    start(async () => {
      try {
        const res = await fn();
        if (res?.error) {
          setNote(res.error);
          return;
        }
        setMode(null);
        router.refresh();
      } catch (e) {
        setNote(e instanceof Error ? e.message : "That didn't work, try again");
      }
    });
  }

  const controls =
    mode === "spotlight" ? (
      <form
        className="vbar-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => spotlightEntry(map.entryId, why));
        }}
      >
        <input
          type="text"
          value={why}
          maxLength={140}
          placeholder="Why it needs a look (optional)"
          aria-label="Why it needs a look"
          onChange={(e) => setWhy(e.target.value)}
          autoFocus
        />
        <button className="btn btn-sm btn-primary" type="submit" disabled={pending}>
          Pin
        </button>
        <button className="btn btn-sm" type="button" onClick={() => setMode(null)}>
          Cancel
        </button>
      </form>
    ) : mode === "stay" || mode === "remove" ? (
      <div className="vbar-form">
        <span className="small">
          {mode === "stay"
            ? "Keep it in " + pack + " and clear the votes?"
            : "Move it to " + deletedPack + " and clear the votes?"}
        </span>
        <button
          className={"btn btn-sm " + (mode === "stay" ? "btn-ok" : "btn-no")}
          type="button"
          disabled={pending}
          onClick={() => run(() => settleStay(map.entryId, mode))}
        >
          Confirm
        </button>
        <button className="btn btn-sm" type="button" onClick={() => setMode(null)}>
          Cancel
        </button>
      </div>
    ) : may.spotlight || may.settle ? (
      <div className="vbar-links">
        {may.spotlight ? (
          spotlight ? (
            <button
              className="linkbtn"
              type="button"
              disabled={pending}
              onClick={() => run(() => unspotlightEntry(map.entryId))}
            >
              Unpin
            </button>
          ) : (
            <button className="linkbtn" type="button" onClick={() => setMode("spotlight")}>
              Spotlight
            </button>
          )
        ) : null}
        {may.settle ? (
          <>
            <button
              className="linkbtn"
              type="button"
              title={"Close the vote, the map stays in " + pack}
              onClick={() => setMode("stay")}
            >
              Keep it
            </button>
            <button
              className="linkbtn"
              type="button"
              data-tone="bad"
              title={"Close the vote and move the map to " + deletedPack}
              onClick={() => setMode("remove")}
            >
              Remove it
            </button>
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <MapCard
      osuBeatmapId={map.osuBeatmapId}
      osuBeatmapsetId={map.osuBeatmapsetId}
      title={map.title}
      version={map.version}
      mapper={map.mapper}
      tierOrder={map.tierOrder}
      stars={map.stars}
      bpm={map.bpm}
      drain={map.drain}
      cs={map.cs}
      ar={map.ar}
      od={map.od}
      href={mapHref(map.osuBeatmapId, map.mod)}
      copyId
      tone={focus ? "attention" : undefined}
      pack={
        <>
          <PackTile tierOrder={map.tierOrder} />
          {map.pack ? <SpecialChip pack={map.pack} /> : null}
        </>
      }
      tags={
        <>
          <ModIcons mod={map.mod} />
          <CategoryChips categories={map.categories} />
        </>
      }
      footer={
        <div className="vbar">
          {spotlight ? (
            <p className="vbar-note">
              {spotlight.note ? (
                <>
                  <q>{spotlight.note}</q>
                  {spotlight.by ? <i> · {spotlight.by}</i> : null}
                </>
              ) : (
                "Pinned" + (spotlight.by ? " by " + spotlight.by : "")
              )}
            </p>
          ) : null}
          <div className="vbar-row">
            <PlayersSay tierOrder={map.tierOrder} tally={players} />
            <Voters tally={shown} />
            {lean ? (
              <span className={"chip " + (lean === "drop" ? "bad" : lean === "stay" ? "ok" : "warn")}>
                {lean === "drop" ? "Leaning delete" : lean === "stay" ? "Leaning stay" : "Split"}
              </span>
            ) : null}
            <div className="svote" role="group" aria-label={"Should this map stay in " + pack + "?"}>
              <button
                className="svote-btn"
                type="button"
                data-side="stay"
                aria-pressed={shown.mine === true}
                title={shown.mine === true ? "Your vote, click to take it back" : "Stay in " + pack}
                onClick={() => cast(true)}
              >
                Stay <b>{shown.stay.length}</b>
              </button>
              <button
                className="svote-btn"
                type="button"
                data-side="drop"
                aria-pressed={shown.mine === false}
                title={shown.mine === false ? "Your vote, click to take it back" : "Delete from " + pack}
                onClick={() => cast(false)}
              >
                Delete <b>{shown.drop.length}</b>
              </button>
            </div>
            {controls}
          </div>
          {note ? <span className="pvote-note" role="status">{note}</span> : null}
        </div>
      }
    />
  );
}

/** Who voted each way, oldest vote first. */
function Voters({ tally }: { tally: StayTally }) {
  if (!tally.stay.length && !tally.drop.length) {
    return <span className="vbar-voters">No staff votes yet</span>;
  }
  return (
    <span className="vbar-voters">
      {tally.stay.length ? (
        <span>
          <b>Stay</b> {tally.stay.join(", ")}
        </span>
      ) : null}
      {tally.drop.length ? (
        <span>
          <b>Delete</b> {tally.drop.join(", ")}
        </span>
      ) : null}
    </span>
  );
}

/** Players' pack votes, read only: a pack lower, on par, a pack higher. */
function PlayersSay({ tierOrder, tally }: { tierOrder: number; tally: VoteTally }) {
  const lower = votedPack(tierOrder, -1)?.name;
  const higher = votedPack(tierOrder, 1)?.name;
  const title = [
    lower ? tally.down + " say " + lower : null,
    tally.par + " say it fits",
    higher ? tally.up + " say " + higher : null,
  ].filter(Boolean).join(", ");
  return (
    <span className="chip chip-keyed players-say" title={title}>
      <i>Players</i>
      <b>
        <em>−</em>{tally.down} <em>=</em>{tally.par} <em>+</em>{tally.up}
      </b>
    </span>
  );
}
