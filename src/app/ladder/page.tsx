import { getTierCounts } from "@/lib/queries";
import { LadderGrid, SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LadderPage() {
  const counts = await getTierCounts();
  return (
    <div className="view">
      <SectionHead label="Packs" title="The ladder">
        Sixteen packs in four bands of four. Pack colour is the only colour on the
        site, so the gems carry it and everything else stays out of the way. Pick
        one to filter the bank.
      </SectionHead>
      <LadderGrid counts={counts} />
    </div>
  );
}
