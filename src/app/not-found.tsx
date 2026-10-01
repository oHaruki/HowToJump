import Link from "next/link";
import { SectionHead } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="view">
      <SectionHead label="404" title="Page not found">
        This page does not exist, or the link to it is out of date.
      </SectionHead>
      <div className="row">
        <Link className="btn btn-primary" href="/">
          Back to the overview
        </Link>
        <Link className="btn" href="/maps">
          Browse the bank
        </Link>
      </div>
    </div>
  );
}
