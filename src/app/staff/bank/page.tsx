import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getBankPage, getFacets, getTierCounts, type BankPage } from "@/lib/queries";
import {
  bankCurrentFrom, bankFiltersFrom, bankPageFrom, bankQueryFrom, type Search,
} from "@/lib/bank-params";
import { TIERS } from "@/lib/tiers";
import { Loading, SectionHead } from "@/components/ui";
import { BankAdminTable } from "@/components/BankAdminTable";
import { BankFilters } from "@/components/BankFilters";
import { BankPager } from "@/components/BankPager";
import { BankCount } from "@/components/BankCount";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bank" };

const BASE = "/staff/bank";

export default async function StaffBankPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  if (!can(await auth(), "bank.edit")) redirect("/staff");
  const sp = await searchParams;
  const filters = bankFiltersFrom(sp, true);
  const query = bankQueryFrom(sp);
  const page = bankPageFrom(sp);

  // Not awaited, so the bar is on screen while the rows are still coming.
  const bank = getBankPage(filters, page);

  // The dropdowns and the pack counts read the same side of the ladder the
  // list does, so switching to removed entries cannot offer a category or a
  // pack that has nothing in it.
  const [facets, tierCounts] = await Promise.all([
    getFacets(filters.status),
    getTierCounts(filters.status),
  ]);

  const packCounts: Record<string, number> = {};
  for (const t of TIERS) packCounts[t.slug] = tierCounts.get(t.order) ?? 0;

  return (
    <>
      <SectionHead label="Staff" title="Map bank">
        Move an entry between packs, or pull it out of the bank. Removing keeps the
        row and its scores, it just stops showing. Search to find one entry, or
        filter to Stale label for the rows still carrying wording the grading
        scale has dropped.
      </SectionHead>

      <BankFilters
        basePath={BASE}
        staff
        packCounts={packCounts}
        categories={facets.categories}
        mods={facets.mods}
        lengths={facets.lengths}
        speeds={facets.speeds}
        current={bankCurrentFrom(sp)}
        count={<Suspense fallback="…"><BankCount bank={bank} /></Suspense>}
      />

      <Suspense key={query + "#" + page} fallback={<Loading label="Loading entries" />}>
        <Entries bank={bank} query={query} />
      </Suspense>
    </>
  );
}

async function Entries({ bank, query }: { bank: Promise<BankPage>; query: string }) {
  const b = await bank;
  return (
    <>
      <BankAdminTable rows={b.rows} />
      <BankPager
        basePath={BASE}
        page={b.page}
        pageCount={b.pageCount}
        total={b.total}
        pageSize={b.pageSize}
        query={query}
      />
    </>
  );
}
