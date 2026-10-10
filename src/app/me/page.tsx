import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { categoryBySlug } from "@/lib/tiers";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My profile" };

/** The signed in player's own profile, with the parts only they get. */
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await auth();
  if (!session?.userId) redirect("/");
  const { category } = await searchParams;
  return <ProfileView userId={session.userId} owner category={categoryBySlug(category)} />;
}
