import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBank, getSpecialPack } from "@/lib/queries";
import { isAdmin } from "@/lib/roles";
import { SectionHead } from "@/components/ui";
import { Importer } from "@/components/Importer";
import { BankAdminTable } from "@/components/BankAdminTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Special pack" };

/**
 * One special pack's maps. Admins add them here straight into the pack,
 * past the queue, and edit or remove the ones already in it.
 */
export default async function SpecialPackAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isAdmin(await auth())) redirect("/staff");
  const id = Number((await params).id);
  const pack = Number.isSafeInteger(id) && id > 0 ? await getSpecialPack(id) : null;
  if (!pack) notFound();
  const maps = await getBank({ specialPack: pack.id });

  return (
    <>
      <div className="stack">
        <Link className="lbl bm-back" href="/staff/packs">
          ← Special packs
        </Link>
        <SectionHead label="Special pack" title={pack.name}>
          Maps added here go straight into {pack.name}, past the queue. Set a pack on
          each as usual: it decides what the map pays on {pack.name}&apos;s board, and
          none of it counts toward levels. <Link href={"/packs/" + pack.id}>See its page</Link>
        </SectionHead>
      </div>

      <Importer pack={{ id: pack.id, name: pack.name, color: pack.color }} />

      <div className="stack">
        <span className="lbl">
          In {pack.name} ({maps.length})
        </span>
        <BankAdminTable rows={maps} />
      </div>
    </>
  );
}
