"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMyLinks } from "@/lib/actions";
import { MAX_LINKS } from "@/lib/links";

const PLACEHOLDERS = ["https://x.com/you", "https://youtube.com/@you"];

/** A staff member's own links, changed in place on their team card. */
export function TeamLinksForm({ links }: { links: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        className="btn btn-sm team-edit"
        type="button"
        onClick={() => {
          setValues(Array.from({ length: MAX_LINKS }, (_, i) => links[i] ?? ""));
          setError(null);
          setEditing(true);
        }}
      >
        Edit your links
      </button>
    );
  }

  return (
    <form
      className="team-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          try {
            const r = await setMyLinks(values);
            if (r.error) {
              setError(r.error);
              return;
            }
            setEditing(false);
            router.refresh();
          } catch {
            setError("Something went wrong. Try again.");
          }
        });
      }}
    >
      {values.map((value, i) => (
        <input
          key={i}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label={"Link " + (i + 1)}
          placeholder={PLACEHOLDERS[i]}
          value={value}
          onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
        />
      ))}
      <p className="small">
        Your osu! profile is always linked. Twitter, YouTube, Twitch and the other big
        sites show their own icon.
      </p>
      {error ? (
        <p className="team-msg" role="status">
          {error}
        </p>
      ) : null}
      <div className="row-tight">
        <button className="btn btn-sm btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving" : "Save"}
        </button>
        <button
          className="btn btn-sm"
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
