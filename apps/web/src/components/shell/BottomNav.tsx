"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveNav, type NavItem } from "@/lib/shell/nav";
import { NAV_ICONS } from "./nav-icons";
import { cn } from "@/lib/cn";

/**
 * Employee bottom navigation (component-specifications.md §15).
 * - Max 4 items, labels ALWAYS visible, no centre FAB.
 * - Active = colour + 3px top indicator (never colour alone).
 * - Items for disabled modules are absent — the bar re-balances.
 * - Hidden at md and above, where the sidebar takes over.
 *
 * The cap is applied by `bottomBarItems` in lib/shell/nav.ts, not here:
 * it is a property of this bar, and everything that does not fit is still
 * reachable from the menu drawer and the sidebar.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-default",
        // Fixed, so it sits outside body's inset padding and has to repeat
        // it — otherwise a tab lands under the notch in landscape.
        "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden",
      )}
    >
      <ul
        className="grid h-[var(--fh-layout-bottom-nav-height)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item) => {
          const active = isActiveNav(item.href, pathname);
          const Icon = NAV_ICONS[item.icon];
          return (
            <li key={item.href} className="relative">
              {/* 3px top indicator: state is never colour alone. */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-b-xs bg-brand-primary"
                />
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-12 flex-col items-center justify-center gap-0.5",
                  active ? "text-brand-primary" : "text-text-tertiary",
                )}
              >
                <Icon aria-hidden="true" className="size-6" />
                <span className="text-caption font-semibold">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
