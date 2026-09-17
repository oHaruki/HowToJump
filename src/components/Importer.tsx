"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importRows, previewPaste, starRatingFor, type PreviewRow,
} from "@/lib/actions";
import { normalizations, secondsToDrain } from "@/lib/import/parse";
import { applyMod, lengthBucketFor, speedGuessFor } from "@/lib/osu/modmath";
import {
  TIERS, tierByName, tierByOrder, tierBySlug, CATEGORIES, LENGTHS, SPEEDS,
} from "@/lib/tiers";
import { MODS } from "@/lib/mods";
import { MapCard } from "@/components/MapCard";
import { PackPicker } from "@/components/PackPicker";

type Row = PreviewRow & { selected: boolean };

const PLACEHOLDER_LINKS = [
  "https://osu.ppy.sh/beatmapsets/2353663#osu/5066679",
  "https://osu.ppy.sh/beatmapsets/2377969#osu/5137765",
  "5309916",
];

const STATUS_CHIP: Record<string, [string, string]> = {
  new: ["ok", "Ready"],
  exists: ["", "On ladder"],
  duplicate: ["warn", "Duplicate"],
  attention: ["warn", "Needs info"],
  error: ["bad", "Error"],
};

export function Importer() {
  const router = useRouter();
  const [source, setSource] = useState<"link" | "paste">("link");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;

  const linkRef = useRef<HTMLTextAreaElement>(null);
  const [linkTier, setLinkTier] = useState("");
  const [linkCat, setLinkCat] = useState("");
  const [linkMod, setLinkMod] = useState("NM");

  const detected = useMemo(() => {
    if (!text.trim()) return "Nothing to read";
    if (text.includes("\t")) return "Detected: spreadsheet rows";
    if (text.includes(",")) return "Detected: comma separated";
    return "Detected: links and IDs";
  }, [text]);

  const read = useCallback((payload: string) => {
    setError(null);
    start(async () => {
      try {
        const res = await previewPaste(payload);
        setMode(res.mode);
        setRows(res.rows.map((r) => ({ ...r, selected: false })));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, []);

  const addLinks = useCallback(() => {
    const v = linkRef.current?.value.trim();
    if (!v) return;
    setError(null);
    start(async () => {
      try {
        // One request for the whole list, so twenty links are one API batch.
        const res = await previewPaste(
          v,
          { tier: linkTier, category: linkCat, mod: linkMod },
          true,
        );
        setRows((prev) =>
          revalidate([...prev, ...res.rows.map((r) => ({ ...r, selected: false }))]),
        );
        if (linkRef.current) linkRef.current.value = "";
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, [linkTier, linkCat, linkMod]);

  const readFile = useCallback(
    (f: File) => {
      setFileName(f.name);
      const fr = new FileReader();
      fr.onload = () => read(String(fr.result));
      fr.readAsText(f);
    },
    [read],
  );

  /** Re-derives status locally so edits feel instant, without a round trip. */
  const patch = useCallback((uid: string, change: Partial<Row>) => {
    setRows((prev) => revalidate(prev.map((r) => (r.uid === uid ? { ...r, ...change } : r))));
  }, []);

  /**
   * Mods change the values a player actually sees, so the row is recomputed
   * from its nomod base. Everything but star rating is arithmetic and happens
   * here; the rating needs osu!'s difficulty calculator, so it follows.
   */
  const changeMod = useCallback((uid: string, mod: string) => {
    setRows((prev) =>
      revalidate(
        prev.map((r) => {
          if (r.uid !== uid) return r;
          const adj = applyMod(
            {
              cs: r.baseCs, ar: r.baseAr, od: r.baseOd,
              bpm: r.baseBpm, drainSeconds: r.baseDrainSeconds,
            },
            mod,
          );
          return {
            ...r,
            mod,
            ...adj,
            drain: secondsToDrain(adj.drainSeconds),
            length: lengthBucketFor(adj.drainSeconds),
            speed: speedGuessFor(adj.bpm),
            stars: mod === "NM" ? r.baseStars : r.stars,
          };
        }),
      ),
    );

    const row = rowsRef.current.find((r) => r.uid === uid);
    if (!row?.beatmapId) return;
    if (mod === "NM") return;
    start(async () => {
      const sr = await starRatingFor(row.beatmapId!, mod);
      if (sr == null) return;
      setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, stars: sr } : r)));
    });
  }, []);

  const bulk = useCallback((change: Partial<Row>) => {
    setRows((prev) =>
      revalidate(prev.map((r) => (r.selected && r.status !== "error" ? { ...r, ...change } : r))),
    );
  }, []);

  const tally = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of rows) t[r.status] = (t[r.status] ?? 0) + 1;
    return t;
  }, [rows]);

  const ready = rows.filter((r) => r.status === "new");
  const blocked = rows.filter((r) => r.status === "attention").length;
  const selectedCount = rows.filter((r) => r.selected).length;

  const send = useCallback(() => {
    if (!ready.length) return;
    setError(null);
    start(async () => {
      try {
        await importRows(
          ready.map((r) => ({
            beatmapId: r.beatmapId!,
            beatmapsetId: r.beatmapsetId,
            title: r.title,
            version: r.version,
            mapper: r.mapper,
            mod: r.mod,
            tierOrder: r.tierOrder!,
            category: r.category,
            length: r.length,
            speed: r.speed,
            stars: r.stars,
            bpm: r.bpm,
            drainSeconds: r.drainSeconds,
            cs: r.cs,
            ar: r.ar,
            od: r.od,
            raw: r.raw,
          })),
          fileName ? "upload" : source === "link" ? "link" : "paste",
        );
        setRows((prev) => prev.filter((r) => r.status !== "new"));
        router.push("/staff/queue");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }, [ready, fileName, source, router]);

  return (
    <>
      <div className="seg" role="tablist">
        <button
          type="button" role="tab"
          aria-selected={source === "link"}
          onClick={() => setSource("link")}
        >
          Add links
        </button>
        <button
          type="button" role="tab"
          aria-selected={source === "paste"}
          onClick={() => setSource("paste")}
        >
          Paste or upload
        </button>
      </div>

      {error ? (
        <div className="notice bad">
          <span className="chip bad" style={{ flex: "none" }}>Error</span>
          <div>{error}</div>
        </div>
      ) : null}

      {source === "paste" ? (
        <div className="stack-lg">
          <div className="box stack">
            <div className="row spread">
              <span className="lbl">Paste rows from the spreadsheet</span>
              <span className="small">{detected}</span>
            </div>
            <textarea
              rows={8}
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Paste spreadsheet rows"
            />
            <div className="row">
              <button
                className="btn btn-primary"
                type="button"
                disabled={pending || !text.trim()}
                onClick={() => read(text)}
              >
                {pending ? "Reading" : "Read rows"}
              </button>
            </div>
            <p className="small">
              Copying a range out of Google Sheets puts tab separated text on the
              clipboard, so pasting straight in works. Headers are matched by name
              and are optional.
            </p>
          </div>

          <div
            className="drop"
            data-over={String(over)}
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files[0];
              if (f) readFile(f);
            }}
          >
            <strong style={{ color: "var(--text-focus)" }}>Or drop a CSV or TSV here</strong>
            <span className="small">Exported from any spreadsheet</span>
            <label className="btn" style={{ marginTop: 4 }}>
              Choose a file
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                }}
              />
            </label>
            {fileName ? <span className="small">{fileName}</span> : null}
          </div>
        </div>
      ) : (
        <div className="box stack">
          <div className="row spread">
            <span className="lbl">Paste links, one per line</span>
            <span className="small">Pack, category and mod apply to all of them</span>
          </div>
          <textarea
            ref={linkRef}
            rows={6}
            spellCheck={false}
            aria-label="Beatmap links or IDs, one per line"
            placeholder={PLACEHOLDER_LINKS.join(String.fromCharCode(10))}
          />
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 190px" }}>
              <span className="lbl">Pack</span>
              <PackPicker
                value={tierByName(linkTier)?.slug ?? ""}
                placeholder="Pick a pack"
                onChange={(slug) => setLinkTier(tierBySlug(slug)?.name ?? "")}
              />
            </label>
            <label className="field" style={{ flex: "1 1 170px" }}>
              <span className="lbl">Category</span>
              <select value={linkCat} onChange={(e) => setLinkCat(e.target.value)}>
                <option value="">Pick a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: "1 1 120px" }}>
              <span className="lbl">Mod</span>
              <select value={linkMod} onChange={(e) => setLinkMod(e.target.value)}>
                {MODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending}
              onClick={addLinks}
            >
              {pending ? "Looking up" : "Add to preview"}
            </button>
          </div>
          <p className="small">
            Copy the link with the difficulty selected. Titles, mappers and
            difficulty values all come from the osu! API. Anything needing a
            different pack can be changed per row in the preview below.
          </p>
        </div>
      )}

      {rows.length ? (
        <div className="stack-lg">
          <div className="row spread">
            <span className="lbl">Preview{mode ? " (" + mode + ")" : ""}</span>
            <span className="row-tight">
              {(["new", "attention", "exists", "duplicate", "error"] as const).map((k) =>
                tally[k] ? (
                  <span key={k} className={"chip " + STATUS_CHIP[k][0]}>
                    {tally[k]} {STATUS_CHIP[k][1].toLowerCase()}
                  </span>
                ) : null,
              )}
            </span>
          </div>

          <div className="bulkbar">
            <label className="row-tight" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedCount > 0 && selectedCount === rows.length}
                onChange={(e) =>
                  setRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))
                }
              />
              <span>{selectedCount} selected</span>
            </label>
            <span style={{ flex: "1 1 auto" }} />
            <span className="small">Set for selected:</span>
            <div style={{ width: 170 }}>
              <PackPicker
                value=""
                placeholder="Set pack"
                allowClear={false}
                onChange={(slug) => {
                  const t = tierBySlug(slug);
                  if (t) bulk({ tier: t.name });
                }}
              />
            </div>
            <select
              className="mini"
              value=""
              onChange={(e) => { if (e.target.value) bulk({ category: e.target.value }); }}
            >
              <option value="">Set category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="mini"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                // Each row recalculates from its own nomod base.
                rowsRef.current
                  .filter((r) => r.selected && r.status !== "error")
                  .forEach((r) => changeMod(r.uid, v));
                e.target.value = "";
              }}
            >
              <option value="">Set mod</option>
              {MODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="mini"
              value=""
              onChange={(e) => { if (e.target.value) bulk({ length: e.target.value }); }}
            >
              <option value="">Set length</option>
              {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              className="mini"
              value=""
              onChange={(e) => { if (e.target.value) bulk({ speed: e.target.value }); }}
            >
              <option value="">Set speed</option>
              {SPEEDS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => setRows((prev) => prev.filter((r) => !r.selected))}
            >
              Remove selected
            </button>
          </div>

          <div className="review-list">
            {rows.map((r) => {
              const isErr = r.status === "error";
              const norms = normalizations(r as never);
              const tone =
                r.status === "error"
                  ? ("error" as const)
                  : r.status === "attention"
                    ? ("attention" as const)
                    : r.status === "exists" || r.status === "duplicate"
                      ? ("muted" as const)
                      : undefined;
              return (
                <MapCard
                  key={r.uid}
                  osuBeatmapId={r.beatmapId ?? 0}
                  osuBeatmapsetId={r.beatmapsetId}
                  title={r.title}
                  version={r.version}
                  mapper={r.notes.length ? r.notes[0] : r.mapper}
                  tierOrder={r.tierOrder}
                  stars={r.stars}
                  bpm={r.bpm}
                  drain={secondsToDrain(r.drainSeconds)}
                  cs={r.cs}
                  ar={r.ar}
                  od={r.od}
                  tone={tone}
                  linkTitle={!isErr}
                  leading={
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={(e) => patch(r.uid, { selected: e.target.checked })}
                      aria-label={"Select " + (r.title || "row")}
                    />
                  }
                  packEditable={!isErr}
                  pack={
                    isErr ? undefined : (
                      <PackPicker
                        value={tierByOrder(r.tierOrder)?.slug ?? ""}
                        onChange={(slug) => {
                          const t = tierBySlug(slug);
                          patch(r.uid, { tier: t ? t.name : "" });
                        }}
                      />
                    )
                  }
                  tags={
                    isErr ? undefined : (
                      <>
                        <select
                          className="mini"
                          value={r.mod}
                          onChange={(e) => changeMod(r.uid, e.target.value)}
                        >
                          {MODS.concat(MODS.includes(r.mod) ? [] : [r.mod]).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <select
                          className="mini"
                          value={r.category}
                          onChange={(e) => patch(r.uid, { category: e.target.value })}
                        >
                          <option value="">Pick a category</option>
                          {CATEGORIES.concat(
                            r.category && !CATEGORIES.includes(r.category) ? [r.category] : [],
                          ).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          className="mini"
                          value={r.length}
                          onChange={(e) => patch(r.uid, { length: e.target.value })}
                        >
                          <option value="">Length</option>
                          {LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <select
                          className="mini"
                          value={r.speed}
                          onChange={(e) => patch(r.uid, { speed: e.target.value })}
                        >
                          <option value="">Speed</option>
                          {SPEEDS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                        </select>
                        {norms.length ? (
                          <span className="diffcol">
                            {norms.slice(0, 2).map((pair, i) => (
                              <span key={i}>
                                {i ? "   " : ""}
                                <s>{pair[0]}</s> &rarr; <b>{pair[1]}</b>
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </>
                    )
                  }
                  status={
                    <span className={"chip " + STATUS_CHIP[r.status][0]}>
                      {STATUS_CHIP[r.status][1]}
                    </span>
                  }
                />
              );
            })}
          </div>

          <div className="row spread">
            <span className="small">
              {ready.length
                ? ready.length +
                  " ready to send" +
                  (blocked ? ", " + blocked + " still need a pack or category" : "")
                : blocked
                  ? "Fill in the missing packs and categories to continue."
                  : "Nothing new here."}
            </span>
            <div className="row">
              <button className="btn" type="button" onClick={() => setRows([])}>
                Discard
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={pending || !ready.length}
                onClick={send}
              >
                Send to queue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Mirrors the server's checks so the preview updates the moment staff change a
 * dropdown. The server re-validates on import, so this is purely for feel.
 */
function revalidate(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    if (r.status === "error") return r;
    const tier = tierByName(r.tier);
    const notes: string[] = [];
    if (!tier) notes.push(r.tier ? "Unknown pack: " + r.tier : "Pick a pack");
    if (!r.category) notes.push("Pick a category");

    const key = r.beatmapId + "|" + r.mod;
    let status = notes.length ? "attention" : "new";
    if (r.status === "exists") status = "exists";
    else if (seen.has(key)) status = "duplicate";
    seen.add(key);

    return {
      ...r,
      tierOrder: tier ? tier.order : null,
      notes: status === "duplicate" ? ["Same map and mod appears earlier"] : notes,
      status: status as Row["status"],
    };
  });
}
