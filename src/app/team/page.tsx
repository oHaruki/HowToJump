import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { getRoles } from "@/lib/queries";
import { PLAYER } from "@/lib/roles";
import { Flag, SectionHead } from "@/components/ui";
import { LinkChip } from "@/components/LinkChip";
import { TeamLinksForm } from "@/components/TeamLinksForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Team" };

/**
 * The people behind the site, a role at a time in the order the roles board
 * lists them, each with their osu! profile and up to two links of their
 * own. A member sees a way to change their own links on their card.
 */
export default async function TeamPage() {
  const [session, roles, members] = await Promise.all([
    auth(),
    getRoles(),
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
      .where(and(ne(users.role, PLAYER.key), isNull(users.bannedAt)))
      .orderBy(asc(users.createdAt)),
  ]);
  const order = new Map(roles.map((r, i) => [r.key, i]));
  const names = new Map(roles.map((r) => [r.key, r.name]));
  const team = members
    .filter((m) => order.has(m.role))
    .sort((a, b) => order.get(a.role)! - order.get(b.role)!);

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
                  <span className="chip">{names.get(m.role)}</span>
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
