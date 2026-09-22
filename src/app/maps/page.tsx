import { Suspense } from "react";
import type { Metadata } from "next";
import { getBankPage, getFacets, getTierCounts, type BankPage } from "@/lib/queries";
import {
  bankCurrentFrom, bankFiltersFrom, bankPageFrom, bankQueryFrom, type Search,
} from "@/lib/bank-params";
import { TIERS } from "@/lib/tiers";
import { Loading, SectionHead } from "@/components/ui";
import { MapList } from "@/components/MapList";
import { BankFilters } from "@/components/BankFilters";
import { BankPager } from "@/components/BankPager";
import { BankCount } from "@/components/BankCount";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Map bank" };

export default async function MapsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const query = bankQueryFrom(sp);
  const page = bankPageFrom(sp);

  /*
   * Started, deliberately not awaited. The promise goes to a suspended
   * child, so the heading and the filter bar are sent and usable while the
   * rows are still being fetched.
   */
  const bank = getBankPage(bankFiltersFrom(sp), page);

  // These two are aggregates over one table, and the bar cannot be drawn
  // without them, so they are worth waiting for.
  const [facets, tierCounts] = await Promise.all([getFacets(), getTierCounts()]);

  // Counts keyed by slug, so the picker can show how full each pack is.
  const packCounts: Record<string, number> = {};
  for (const t of TIERS) packCounts[t.slug] = tierCounts.get(t.order) ?? 0;

  return (
    <div className="view">
      <SectionHead label="Map bank" title="Every judged entry" />

      <BankFilters
        packCounts={packCounts}
        categories={facets.categories}
        mods={facets.mods}
        lengths={facets.lengths}
        speeds={facets.speeds}
        current={bankCurrentFrom(sp)}
        count={<Suspense fallback="…"><BankCount bank={bank} /></Suspense>}
      />

      {/* Keyed on the filters, so changing one shows the wait again rather
          than leaving the previous page's maps sitting there. */}
      <Suspense key={query + "#" + page} fallback={<Loading label="Loading maps" />}>
        <Maps bank={bank} query={query} />
      </Suspense>
    </div>
  );
}

async function Maps({ bank, query }: { bank: Promise<BankPage>; query: string }) {
  const b = await bank;
  return (
    <>
      <MapList rows={b.rows} />
      <BankPager
        page={b.page}
        pageCount={b.pageCount}
        total={b.total}
        pageSize={b.pageSize}
        query={query}
      />
    </>
  );
}
