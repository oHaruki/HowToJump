import type { Metadata } from "next";
import { getTierCounts } from "@/lib/queries";
import { LadderGrid, SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Packs" };

export default async function LadderPage() {
  const counts = await getTierCounts();
  return (
    <div className="view">
      <SectionHead label="Packs" title="Packs" />
      <LadderGrid counts={counts} />
    </div>
  );
}
