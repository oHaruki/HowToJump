"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addScoreByLink } from "@/lib/actions";

/** Takes an osu! score link and adds that score to the player's own profile. */
export function BackfillForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  return (
    <form
      className="backfill"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          try {
            const r = await addScoreByLink(link);
            if (r.error) {
              setMsg({ text: r.error, ok: false });
              return;
            }
            setMsg({ text: (r.improved ? "Improved: " : "Added: ") + r.added, ok: true });
            setLink("");
            router.refresh();
          } catch {
            setMsg({ text: "Something went wrong. Try again.", ok: false });
          }
        });
      }}
    >
      <div className="backfill-row">
        <input
          type="text"
          id="backfill-link"
          name="link"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label="Score link"
          placeholder="https://osu.ppy.sh/scores/7534121696"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={pending || !link.trim()}>
          {pending ? "Adding" : "Add score"}
        </button>
      </div>
      {msg ? (
        <p className="backfill-msg" data-ok={msg.ok} role="status">
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
