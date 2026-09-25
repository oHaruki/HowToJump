import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/roles";
import { Importer } from "@/components/Importer";
import { SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Add maps" };

export default async function AddMapsPage() {
  if (!can(await auth(), "maps.add")) redirect("/staff");
  return (
    <>
      <SectionHead label="Staff" title="Add maps">
        Both routes land in the same preview, where you set pack, category and mod
        before a single row is written.
      </SectionHead>
      <Importer />
    </>
  );
}
