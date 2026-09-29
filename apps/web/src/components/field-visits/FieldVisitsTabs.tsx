import Link from "next/link";
import { cn } from "@/lib/cn";

/** Today · Report · Places — the owner's field visit screens. */
export function FieldVisitsTabs({
  current,
  places,
}: {
  current: "today" | "report" | "places";
  /** Only people who see everyone's visits look after the places list. */
  places: boolean;
}) {
  const tabs = [
    { key: "today", href: "/admin/field-visits", label: "Today" },
    { key: "report", href: "/admin/field-visits/report", label: "Report" },
    ...(places ? [{ key: "places", href: "/admin/field-visits/places", label: "Places" }] : []),
  ];
  return (
    <nav aria-label="Field visits" className="flex gap-1 border-b border-border-subtle">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-label",
            tab.key === current
              ? "border-brand-primary text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
