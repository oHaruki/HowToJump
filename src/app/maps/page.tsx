import { getBank, getFacets } from "@/lib/queries";
import { TIERS, tierBySlug } from "@/lib/tiers";
import { MapCell, ModChip, NONE, SectionHead, TierChip } from "@/components/ui";
import { BankFilters } from "@/components/BankFilters";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function MapsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const packSlug = one(sp.pack);
  const pack = packSlug ? tierBySlug(packSlug) : null;

  const filters = {
    q: one(sp.q) || undefined,
    pack: pack?.order,
    category: one(sp.category) || undefined,
    mod: one(sp.mod) || undefined,
    length: one(sp.length) || undefined,
    speed: one(sp.speed) || undefined,
  };

  const [rows, facets] = await Promise.all([getBank(filters), getFacets()]);

  return (
    <div className="view">
      <SectionHead label="Map bank" title="Every judged entry">
        Star rating, BPM and drain come from the osu! API. Pack, category, mod and
        pacing are assigned by staff.
      </SectionHead>

      <BankFilters
        packs={TIERS.map((t) => ({ slug: t.slug, name: t.name }))}
        categories={facets.categories}
        mods={facets.mods}
        lengths={facets.lengths}
        speeds={facets.speeds}
        current={{
          q: one(sp.q),
          pack: packSlug,
          category: one(sp.category),
          mod: one(sp.mod),
          length: one(sp.length),
          speed: one(sp.speed),
        }}
      />

      <div className="table-wrap">
        <table className="wide">
          <thead>
            <tr>
              <th>Map</th>
              <th>Mod</th>
              <th>Pack</th>
              <th>Category</th>
              <th>Stars</th>
              <th>BPM</th>
              <th>Drain</th>
              <th>CS / AR / OD</th>
              <th>Pacing</th>
              <th>Mapper</th>
              <th>Judged</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.entryId}>
                <td>
                  <MapCell map={m} />
                </td>
                <td>
                  <ModChip mod={m.mod} />
                </td>
                <td>
                  <TierChip tier={m.tierOrder} />
                </td>
                <td>{m.category}</td>
                <td className="num">
                  {m.stars != null ? m.stars.toFixed(2) + "★" : NONE}
                </td>
                <td className="num">{m.bpm != null ? Math.round(m.bpm) : NONE}</td>
                <td className="num">{m.drain || NONE}</td>
                <td className="trio">
                  <b>{m.cs ?? NONE}</b> / <b>{m.ar ?? NONE}</b> / <b>{m.od ?? NONE}</b>
                </td>
                <td className="small">
                  {(m.lengthBucket || NONE) + " " + NONE + " " + (m.speedBucket || NONE)}
                </td>
                <td>{m.mapper || NONE}</td>
                <td className="small">{m.judgedByName || NONE}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={11} className="small">
                  Nothing matches those filters yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="small">
        {rows.length} {rows.length === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}
