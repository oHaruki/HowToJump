import type { BankPage } from "@/lib/queries";

/**
 * How many entries the filters match, as its own suspending component.
 *
 * The count and the list come out of the same query, so the filter bar would
 * otherwise have to wait for the rows before it could be drawn at all. Split
 * out, the bar goes out with the rest of the page and only this one number
 * arrives late.
 */
export async function BankCount({ bank }: { bank: Promise<BankPage> }) {
  const { total } = await bank;
  return (
    <>
      {total} {total === 1 ? "entry" : "entries"}
    </>
  );
}
