import { signIn, signOut } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  user: "Player",
  helper: "Helper",
  admin: "Admin",
};

/**
 * Sign in goes straight to osu!, so there is no credential form and nothing
 * to collect. Both branches are plain server actions.
 */
export function AuthButton({
  user,
}: {
  user: { name: string; image: string | null; role: string } | null;
}) {
  if (!user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("osu", { redirectTo: "/me" });
        }}
      >
        <button className="tool" type="submit">
          Sign in with osu!
        </button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button className="tool userbtn" type="submit" title="Sign out">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="av" src={user.image} alt="" />
        ) : null}
        <span style={{ color: "var(--text-focus)" }}>{user.name}</span>
        <span className="small">{ROLE_LABEL[user.role] ?? user.role}</span>
      </button>
    </form>
  );
}
