import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, isNull, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { getRoles } from "@/lib/queries";
import { Flag, SectionHead } from "@/components/ui";
import { LinkChip } from "@/components/LinkChip";
import { TeamLinksForm } from "@/components/TeamLinksForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Team" };

/**
 * The people behind the site, a row for each role from the highest down.
 * Someone holding several roles shows once, under the highest, with every
 * role they hold beside their name. Each card links the member's osu!
 * profile and up to two links of their own, which they change on their card.
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
        roles: users.roles,
        socialLinks: users.socialLinks,
      })
      .from(users)
      .where(and(raw`cardinality(${users.roles}) > 0`, isNull(users.bannedAt)))
      .orderBy(asc(users.createdAt)),
  ]);

  // The roles come highest first, so each member's first one is their highest.
  const people = members
    .map((m) => ({ ...m, held: roles.filter((r) => m.roles.includes(r.key)) }))
    .filter((m) => m.held.length);
  const tiers = roles
    .map((role) => ({ role, members: people.filter((p) => p.held[0].key === role.key) }))
    .filter((t) => t.members.length);

  return (
    <div className="view">
      <SectionHead label="Team" title="The team">
        The people behind Project Aim. Helpers add and judge the maps, and admins run
        the site as well.
      </SectionHead>

      {tiers.length ? (
        tiers.map((t) => (
          <section className="stack" key={t.role.key}>
            <span className="lbl">{t.role.name}</span>
            <div className="team-grid">
              {t.members.map((m) => (
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
                      <div className="row-tight">
                        {m.held.map((r) => (
                          <span className="chip" key={r.key}>
                            {r.name}
                          </span>
                        ))}
                      </div>
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
          </section>
        ))
      ) : (
        <p className="small">Nobody is on the team yet.</p>
      )}
    </div>
  );
}
