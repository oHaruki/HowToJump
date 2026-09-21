import { auth } from "@/lib/auth";
import { getPendingSuggestions } from "@/lib/queries";
import { SectionHead } from "@/components/ui";
import { QueueTable } from "@/components/QueueTable";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [session, rows] = await Promise.all([auth(), getPendingSuggestions()]);
  // Helpers fill this queue; only an admin takes anything out of it into the
  // bank. The layout has already turned away anyone who is neither.
  const canApprove = session?.role === "admin";

  return (
    <>
      <SectionHead label="Staff" title="Review queue">
        {canApprove
          ? "Approving writes the entry into the bank. A pack has to be set first."
          : "Set a pack on everything you add here. An admin approves it into the bank."}
      </SectionHead>
      <QueueTable
        canApprove={canApprove}
        rows={rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }))}
      />
    </>
  );
}
