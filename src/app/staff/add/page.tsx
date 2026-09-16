import { Importer } from "@/components/Importer";
import { SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function AddMapsPage() {
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
