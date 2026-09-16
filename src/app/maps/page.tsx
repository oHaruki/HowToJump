import { getBank, getFacets } from "@/lib/queries";
import { TIERS, tierBySlug } from "@/lib/tiers";
import { SectionHead } from "@/components/ui";
import { MapList } from "@/components/MapList";
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

      <MapList rows={rows} />

      <p className="small">
        {rows.length} {rows.length === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}
