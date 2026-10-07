import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/roles";
import {
  getBankPage, getFacets, getSpecialPacks, getTierCounts, type BankPage,
} from "@/lib/queries";
import { bankFiltersFrom, bankPageFrom, bankQueryFrom, type Search } from "@/lib/bank-params";
import type { SpecialPack } from "@/lib/packs";
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

  // The filters and the pack counts read the same side of the ladder the
  // list does, so switching to removed entries cannot offer a category or a
  // pack that has nothing in it.
  const [facets, tierCounts, specialRows] = await Promise.all([
    getFacets(filters.status, true),
    getTierCounts(filters.status),
    getSpecialPacks(),
  ]);

  const packCounts: Record<string, number> = {};
  for (const t of TIERS) packCounts[t.slug] = tierCounts.get(t.order) ?? 0;
  // A special pack's count is its listed maps, so it only shows beside listed ones.
  if (filters.status === "listed") for (const p of specialRows) packCounts[String(p.id)] = p.maps;
  const special = specialRows.map(({ id, name, color }) => ({ id, name, color }));

  return (
    <>
      <SectionHead label="Staff" title="Map bank">
        Move an entry between packs, or pull it out of the bank. Removing keeps the
        row and its scores, it just stops showing. Search to find one entry, or
        filter to Stale label for the rows still carrying wording the grading
        scale has dropped. Edit an entry to move it into a special pack or back onto
        the ladder. Sorted by pack, special packs&apos; maps come after the ladder&apos;s.
      </SectionHead>

      <BankFilters
        basePath={BASE}
        staff
        packCounts={packCounts}
        facets={facets}
        count={<Suspense fallback="…"><BankCount bank={bank} /></Suspense>}
        special={special}
      />

      <Suspense key={query + "#" + page} fallback={<Loading label="Loading entries" />}>
        <Entries
          bank={bank}
          query={query}
          special={special}
          showAdded={filters.sort !== "pack"}
        />
      </Suspense>
    </>
  );
}

async function Entries({
  bank,
  query,
  special,
  showAdded,
}: {
  bank: Promise<BankPage>;
  query: string;
  special: SpecialPack[];
  showAdded: boolean;
}) {
  const b = await bank;
  return (
    <>
      <BankAdminTable rows={b.rows} special={special} showAdded={showAdded} />
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
