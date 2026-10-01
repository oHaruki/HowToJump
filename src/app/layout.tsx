import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { PLAYER, canUseStaffArea } from "@/lib/roles";
import { AuthButton } from "@/components/AuthButton";
import { NavLinks } from "@/components/NavLinks";
import { SITE_NAME } from "@/lib/site";

const sans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-geist-mono" });

const DESCRIPTION =
  "Ranked osu! aim. Sixteen packs of aim maps from Stone to GOAT, graded on misscount and tracked automatically from your osu! account.";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: "%s · " + SITE_NAME },
  description: DESCRIPTION,
  openGraph: { siteName: SITE_NAME, title: SITE_NAME, description: DESCRIPTION, type: "website" },
};

export const viewport: Viewport = { themeColor: "#151515" };

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Public destinations only. Personal and staff links live in the avatar menu.
  const links = [
    { href: "/", label: "Overview" },
    { href: "/maps", label: "Map bank" },
    { href: "/ladder", label: "Packs" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/info", label: "Info" },
    { href: "/team", label: "Team" },
  ];

  return (
    <html lang="en" className={sans.variable + " " + mono.variable}>
      <body>
        <header className="nav">
          <div className="wrap nav-in">
            <Link className="brand" href="/">
              <span className="brand-mark" />
              Project Aim
            </Link>
            <NavLinks links={links} />
            <div className="nav-tools">
              <AuthButton
                isStaff={canUseStaffArea(session)}
                user={
                  session?.userId
                    ? {
                        name: session.user?.name ?? "",
                        image: session.user?.image ?? null,
                        roleName: session.roleNames.join(" · ") || PLAYER.name,
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
            <span>
              Project Aim
              <span className="small" style={{ marginLeft: 10 }}>
                art by MeiQuing
              </span>
            </span>
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
