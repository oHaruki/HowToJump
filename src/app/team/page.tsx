import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { Flag, SectionHead } from "@/components/ui";
import { LinkChip } from "@/components/LinkChip";
import { TeamLinksForm } from "@/components/TeamLinksForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Team" };

const ROLE_NAMES: Record<string, string> = { admin: "Admin", helper: "Helper" };

/**
 * The people behind the site: the admins, then the helpers, each with their
 * osu! profile and up to two links of their own. A member sees a way to
 * change their own links on their card.
 */
export default async function TeamPage() {
  const [session, team] = await Promise.all([
    auth(),
    db
      .select({
        id: users.id,
        osuUserId: users.osuUserId,
        username: users.username,
        avatarUrl: users.avatarUrl,
        countryCode: users.countryCode,
        role: users.role,
        socialLinks: users.socialLinks,
      })
      .from(users)
      .where(and(inArray(users.role, ["admin", "helper"]), isNull(users.bannedAt)))
      .orderBy(asc(users.role), asc(users.createdAt)),
  ]);

  return (
    <div className="view">
      <SectionHead label="Team" title="The team">
        The people behind Project Aim. Helpers add and judge the maps, and admins run
        the site as well.
      </SectionHead>

      {team.length ? (
        <div className="team-grid">
          {team.map((m) => (
            <article className="box team-card" key={m.id}>
              <div className="team-who">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="team-av" src={m.avatarUrl} alt="" />
                ) : (
                  <span className="team-av" />
                )}
                <div className="team-name">
                  <Link href={"/u/" + m.osuUserId}>
                    <Flag code={m.countryCode} />
                    <span>{m.username}</span>
                  </Link>
                  <span className="chip">{ROLE_NAMES[m.role] ?? m.role}</span>
                </div>
              </div>
              <div className="row-tight">
                <LinkChip href={"https://osu.ppy.sh/users/" + m.osuUserId} />
                {m.socialLinks.map((link) => (
                  <LinkChip key={link} href={link} />
                ))}
              </div>
              {session?.userId === m.id ? <TeamLinksForm links={m.socialLinks} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="small">Nobody is on the team yet.</p>
      )}
    </div>
  );
}
