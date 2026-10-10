"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChoiceMenu } from "@/components/FilterMenu";
import { CATEGORIES, categorySlug, shortCategory } from "@/lib/tiers";

/**
 * Narrows a profile's top plays to one category. The pick lives in the URL
 * as ?category=, so the server draws the list and a narrowed list can be
 * linked. The list dims until the new one arrives.
 */
export function PlayFilter({
  category,
  total,
  counts,
}: {
  /** The category shown, null for every play. */
  category: string | null;
  /** How many plays the player has. */
  total: number;
  /** How many of them are in each category. */
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useOptimistic(category ? categorySlug(category) : "");

  const pick = (next: string) =>
    startTransition(() => {
      setSlug(next);
      router.replace(next ? path + "?category=" + next : path, { scroll: false });
    });

  return (
    <div className="play-filter" data-pending={pending || undefined}>
      <ChoiceMenu
        label="Category"
        value={slug}
        onChange={pick}
        align="end"
        always
        active={!!slug}
        options={[
          { value: "", label: "All", n: total },
          ...CATEGORIES.map((c) => ({
            value: categorySlug(c),
            label: shortCategory(c),
            n: counts[c] ?? 0,
          })),
        ]}
      />
    </div>
  );
}
