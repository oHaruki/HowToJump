"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionHead } from "@/components/ui";

/** Shown in place of a page that threw. Try again refetches it from the server. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="view">
      <SectionHead title="Something went wrong">
        This page could not be loaded. Try again, or come back in a minute.
      </SectionHead>
      <div className="row">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Try again
        </button>
        <Link className="btn" href="/">
          Back to the overview
        </Link>
      </div>
    </div>
  );
}
