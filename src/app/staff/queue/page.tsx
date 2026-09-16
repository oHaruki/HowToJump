import { getPendingSuggestions } from "@/lib/queries";
import { SectionHead } from "@/components/ui";
import { QueueTable } from "@/components/QueueTable";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const rows = await getPendingSuggestions();
  return (
    <>
      <SectionHead label="Staff" title="Review queue">
        Approving writes the entry onto the ladder. A pack has to be set first.
      </SectionHead>
      <QueueTable rows={rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }))} />
    </>
  );
}
