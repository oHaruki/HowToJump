import Link from "next/link";

/**
 * Numbered paging for the bank, as plain links, so the page sits in the URL
 * like every filter does. `query` is the current filters already
 * serialised without a page, so paging never drops one.
 */
export function BankPager({
  basePath = "/maps",
  page,
  pageCount,
  total,
  pageSize,
  query,
  noun = ["entry", "entries"],
}: {
  /** Which bank is being paged. The staff one lives at its own route. */
  basePath?: string;
  /** What is being counted, singular and plural; the leaderboard pages players. */
  noun?: [string, string];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  query: string;
}) {
  const href = (n: number) => {
    const next = new URLSearchParams(query);
    if (n > 1) next.set("page", String(n));
    const s = next.toString();
    return s ? basePath + "?" + s : basePath;
  };

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="pager">
      <p className="small">
        {total === 0
          ? "No " + noun[1]
          : "Showing " + first + "-" + last + " of " + total + " " +
            (total === 1 ? noun[0] : noun[1])}
      </p>

      {pageCount > 1 ? (
        <nav className="pager-nav" aria-label="Pages">
          <Step to={page - 1} page={page} pageCount={pageCount} href={href}>
            Prev
          </Step>

          {pageWindow(page, pageCount).map((n, i) =>
            n === "gap" ? (
              <span key={"gap" + i} className="pager-gap" aria-hidden="true">
                &hellip;
              </span>
            ) : n === page ? (
              <span key={n} className="pager-page" aria-current="page">
                {n}
              </span>
            ) : (
              <Link key={n} className="pager-page" href={href(n)}>
                {n}
              </Link>
            ),
          )}

          <Step to={page + 1} page={page} pageCount={pageCount} href={href}>
            Next
          </Step>
        </nav>
      ) : null}
    </div>
  );
}

/** Prev and Next. Stays in place at the ends rather than shifting the row. */
function Step({
  to,
  pageCount,
  href,
  children,
}: {
  to: number;
  page: number;
  pageCount: number;
  href: (n: number) => string;
  children: React.ReactNode;
}) {
  if (to < 1 || to > pageCount) {
    return (
      <span className="pager-step" aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link className="pager-step" href={href(to)}>
      {children}
    </Link>
  );
}

/**
 * Which page numbers to show: the ends, the current page and its neighbours.
 *
 * A gap standing in for one page would be wider than the number it hides, so
 * a single missing page is filled in instead.
 */
function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const keep = [1, pageCount, page - 1, page, page + 1]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);

  const out: Array<number | "gap"> = [];
  for (const n of keep) {
    const prev = out[out.length - 1];
    if (typeof prev === "number") {
      if (n === prev) continue;
      if (n - prev === 2) out.push(prev + 1);
      else if (n - prev > 2) out.push("gap");
    }
    out.push(n);
  }
  return out;
}
