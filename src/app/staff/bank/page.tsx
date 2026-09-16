import { getBank } from "@/lib/queries";
import { SectionHead } from "@/components/ui";
import { BankAdminTable } from "@/components/BankAdminTable";

export const dynamic = "force-dynamic";

export default async function StaffBankPage() {
  const rows = await getBank();
  return (
    <>
      <SectionHead label="Staff" title="Map bank">
        Move an entry between packs, or pull it off the ladder. Removing keeps the
        row and its scores, it just stops showing.
      </SectionHead>
      <BankAdminTable rows={rows} />
    </>
  );
}
