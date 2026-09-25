import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, canSeeQueue } from "@/lib/roles";
import { getPendingSuggestions } from "@/lib/queries";
import { SectionHead } from "@/components/ui";
import { QueueTable } from "@/components/QueueTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Review queue" };

export default async function QueuePage() {
  const [session, rows] = await Promise.all([auth(), getPendingSuggestions()]);
  if (!canSeeQueue(session)) redirect("/staff");
  const canApprove = can(session, "queue.approve");
  const canReview = can(session, "queue.review");

  return (
    <>
      <SectionHead label="Staff" title="Review queue">
        {canApprove
          ? "Approving writes the entry into the bank. A pack has to be set first."
          : canReview
            ? "Set a pack on everything you add here. Someone who can approve maps moves it into the bank."
            : "What you add waits here until it is reviewed and approved into the bank."}
      </SectionHead>
      <QueueTable
        canApprove={canApprove}
        canReview={canReview}
        rows={rows.map((r) => ({ ...r, createdAt: String(r.createdAt) }))}
      />
    </>
  );
}
