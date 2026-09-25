import { BRAND_PATHS } from "@/lib/brand-icons";
import { linkKind } from "@/lib/links";

/** A link as a chip: the site's own icon and name, or a globe and the host. */
export function LinkChip({ href }: { href: string }) {
  const kind = linkKind(href);
  const path = kind.icon ? BRAND_PATHS[kind.icon] : null;
  return (
    <a className="chip link-chip" href={href} target="_blank" rel="noopener noreferrer" title={href}>
      {path ? (
        <svg className="link-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={path} />
        </svg>
      ) : (
        <svg
          className="link-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18" />
        </svg>
      )}
      {kind.name}
    </a>
  );
}
