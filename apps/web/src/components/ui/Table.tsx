import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Data table (component-specifications.md §14, responsive-layouts.md §4).
 *
 * MANDATORY responsive rule: below `md` the table renders as a stacked
 * card list via `renderMobileCard` — a horizontally scrolling table is not
 * an acceptable mobile fallback for attendance, leave, tasks or payroll.
 *
 * Semantics: real <table>, <th scope="col">, and the row-header column
 * marked with <th scope="row">.
 */
export interface TableColumn<Row> {
  key: string;
  header: string;
  align?: "left" | "right";
  /** Right-aligned mono numerics (times, hours, amounts). */
  numeric?: boolean;
  /** This column is the row header (employee name). */
  rowHeader?: boolean;
  render: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  caption: string;
  columns: Array<TableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Stacked-card renderer for <md viewports. Required by the design system. */
  renderMobileCard: (row: Row) => ReactNode;
  /** Rendered inside the table container when rows is empty. */
  empty?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
  renderMobileCard,
  empty,
  footer,
  className,
}: TableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={className}>
      {/* Mobile: stacked card list (below md). */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)}>{renderMobileCard(row)}</li>
        ))}
      </ul>

      {/* md and up: real table. */}
      <div className="hidden overflow-hidden rounded-surface-card border border-border-default bg-surface-default shadow-elevation-1 md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="bg-surface-sunken">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "micro-label px-4 py-2.5 text-text-tertiary",
                      col.align === "right" || col.numeric
                        ? "text-right"
                        : "text-left",
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="h-13 border-t border-border-subtle transition-colors duration-[var(--fh-motion-duration-fast)] hover:bg-surface-sunken"
                >
                  {columns.map((col) =>
                    col.rowHeader ? (
                      <th
                        key={col.key}
                        scope="row"
                        className="px-4 py-2.5 text-left text-body font-semibold text-text-primary"
                      >
                        {col.render(row)}
                      </th>
                    ) : (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-2.5 text-body text-text-primary",
                          col.numeric &&
                            "text-right font-mono text-data tabular-nums",
                          col.align === "right" && "text-right",
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot className="border-t border-border-default bg-surface-sunken">
                {footer}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
