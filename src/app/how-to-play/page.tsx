import type { Metadata } from "next";
import { auth, signIn } from "@/lib/auth";
import { HowToPlay } from "@/components/HowToPlay";

export const metadata: Metadata = {
  title: "How to play",
  description:
    "Sign in with osu!, pick a map from the bank, play it, and get EXP. The whole loop in four steps.",
};

/** The guide, with its buttons for whether the visitor is signed in. */
export default async function HowToPlayPage() {
  const session = await auth();
  return (
    <HowToPlay
      signedIn={Boolean(session?.userId)}
      signIn={async () => {
        "use server";
        await signIn("osu", { redirectTo: "/maps" });
      }}
    />
  );
}
