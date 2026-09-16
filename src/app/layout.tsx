import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, isStaff } from "@/lib/auth";
import { AuthButton } from "@/components/AuthButton";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "HowToJump",
  description:
    "A judged ladder through osu! aim. Sixteen packs from Stone to GOAT, graded on misscount, tracked automatically from your osu! account.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.role;

  // Public destinations only. Personal and staff links live in the avatar menu.
  const links = [
    { href: "/", label: "Overview" },
    { href: "/maps", label: "Map bank" },
    { href: "/ladder", label: "Ladder" },
    { href: "/info", label: "Info" },
  ];

  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="wrap nav-in">
            <Link className="brand" href="/">
              <span className="brand-mark" />
              HowToJump
            </Link>
            <NavLinks links={links} />
            <div className="nav-tools">
              <AuthButton
                isStaff={isStaff(role)}
                user={
                  session?.userId
                    ? {
                        name: session.user?.name ?? "",
                        image: session.user?.image ?? null,
                        role: session.role,
                        osuUserId: session.osuUserId,
                      }
                    : null
                }
              />
            </div>
          </div>
        </header>

        <main className="wrap">{children}</main>

        <footer className="wrap">
          <div className="row spread">
            <span>HowToJump</span>
            <span>
              <a href="https://osu.ppy.sh" target="_blank" rel="noopener noreferrer">
                osu!
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
