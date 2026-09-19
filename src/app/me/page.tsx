import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

/** The signed in player's own profile, with the parts only they get. */
export default async function MePage() {
  const session = await auth();
  if (!session?.userId) redirect("/");
  return <ProfileView userId={session.userId} owner />;
}
