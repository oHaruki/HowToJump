import { signIn, signOut } from "@/lib/auth";
import { UserMenu, type MenuUser } from "@/components/UserMenu";

/**
 * Sign in goes straight to osu!, so there is no credential form and nothing
 * to collect. Signed in, the avatar opens a menu instead.
 */
export function AuthButton({
  user,
  isStaff,
}: {
  user: MenuUser | null;
  isStaff: boolean;
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
          <span>
            Sign in<span className="signin-more"> with osu!</span>
          </span>
        </button>
      </form>
    );
  }

  return (
    <UserMenu
      user={user}
      isStaff={isStaff}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    />
  );
}
