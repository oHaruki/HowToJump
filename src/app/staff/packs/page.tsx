import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSpecialPacks } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { SectionHead } from "@/components/ui";
import { PacksBoard } from "@/components/PacksBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Special packs" };

/** The packs beside the ladder, which admins make, change and delete here. */
export default async function PacksPage() {
  if (!isAdmin(await auth())) redirect("/staff");

  return (
    <>
      <SectionHead label="Admin" title="Special packs">
        Packs beside the ladder. A map in one is judged into a pack as usual and
        pays EXP on the special pack&apos;s own board, but none of it counts toward
        levels. Add maps to a pack from its Maps page: they go straight in, past the
        queue.
      </SectionHead>
      <PacksBoard packs={await getSpecialPacks()} />
    </>
  );
}
