"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackPicker } from "@/components/PackPicker";

const BASE = "/staff/votes";

/** The votes page's address for a pack, or the pack tab with none picked. */
function votesHref(view: { pack?: string; byPack?: boolean; left: boolean }) {
  const q = new URLSearchParams();
  if (view.pack) q.set("pack", view.pack);
  else if (view.byPack) q.set("by", "pack");
  if (view.left) q.set("left", "1");
  const s = q.toString();
  return BASE + (s ? "?" + s : "");
}

/**
 * Which maps the votes page lists: the open votes, or every map in a pack
 * picked from the ladder. Either can hide the ones already voted on.
 */
export function VoteFilters({
  byPack,
  pack,
  left,
  open,
  counts,
}: {
  byPack: boolean;
  /** The picked pack's slug, "" for none. */
  pack: string;
  /** Hides the maps the viewer already voted on. */
  left: boolean;
  open: number;
  /** Listed maps per pack, keyed by slug. */
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const go = (href: string) => router.push(href, { scroll: false });

  return (
    <div className="stack">
      <nav className="tabs tabs-lg" aria-label="Show">
        <Link href={votesHref({ left })} scroll={false} aria-current={!byPack ? "page" : undefined}>
          Open votes <span className="tab-count">{open}</span>
        </Link>
        <Link
          href={votesHref({ pack, byPack: true, left })}
          scroll={false}
          aria-current={byPack ? "page" : undefined}
        >
          Go through a pack
        </Link>
      </nav>
      <div className="row">
        {byPack ? (
          <div style={{ width: 200 }}>
            <PackPicker
              value={pack}
              counts={counts}
              placeholder="Pick a pack"
              allowClear={false}
              onChange={(slug) => go(votesHref({ pack: slug, left }))}
            />
          </div>
        ) : null}
        <label className="row-tight" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={left}
            onChange={(e) => go(votesHref({ pack, byPack, left: e.target.checked }))}
          />
          <span>Only maps I haven&apos;t voted on</span>
        </label>
      </div>
    </div>
  );
}
