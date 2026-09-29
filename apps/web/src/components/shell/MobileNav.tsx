"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut, Menu } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { IconButton } from "@/components/ui/IconButton";
import { isActiveNav, type NavItem } from "@/lib/shell/nav";
import { NAV_ICONS } from "./nav-icons";
import { cn } from "@/lib/cn";

/**
 * Navigation below `md`, where the sidebar is hidden.
 *
 * Until this existed, an admin on a phone could reach no screen except by
 * typing a URL, and could not sign out at all. `Sidebar`'s docblock has
 * promised a drawer since the shell was written; this is it.
 *
 * Reuses `ui/Drawer` rather than hand-rolling a sheet: it already carries
 * dialog semantics, `showModal`, Escape-to-close and the backdrop, so this
 * adds no new accessibility surface to get wrong.
 *
 * Employees keep the bottom bar for their four main destinations and use
 * this for the rest — Leave, Payslips, documents, sign-out.
 */
export function MobileNav({
  items,
  configItems = [],
  configLabel = "Configuration",
  userName,
  roleName,
}: {
  items: NavItem[];
  configItems?: NavItem[];
  configLabel?: string;
  userName: string;
  roleName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Navigating must close the drawer, or the destination renders behind an
  // open sheet. Adjusted during render rather than in an effect: an effect
  // would set state after commit and cascade a second render, and React
  // documents this shape for "reset state when a prop changes". Covers
  // browser back/forward too, which an onClick handler alone would miss.
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }

  function Row({ href, label, icon }: NavItem) {
    const active = isActiveNav(href, pathname);
    const Icon = NAV_ICONS[icon];
    return (
      <li>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(
            // 48px minimum: this is a thumb target (accessibility.md §3).
            "relative flex min-h-12 items-center gap-3 rounded-md px-3 text-body",
            active
              ? "bg-brand-primary-subtle font-semibold text-brand-primary"
              : "text-text-primary hover:bg-surface-sunken",
          )}
        >
          {active && (
            <span
              aria-hidden="true"
              className="absolute left-0 h-6 w-[3px] rounded-r-xs bg-brand-primary"
            />
          )}
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      </li>
    );
  }

  return (
    <>
      <IconButton
        label="Menu"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="md:hidden"
      >
        <Menu />
      </IconButton>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
        <nav aria-label="All screens">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <Row key={item.href} {...item} />
            ))}
          </ul>

          {configItems.length > 0 && (
            <div className="mt-6">
              <p className="micro-label mb-1.5 px-3 text-text-tertiary">
                {configLabel}
              </p>
              <ul className="flex flex-col gap-0.5">
                {configItems.map((item) => (
                  <Row key={item.href} {...item} />
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="mt-6 border-t border-border-default pt-4">
          <div className="flex items-center gap-3 px-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-primary-subtle font-heading text-label text-brand-primary"
            >
              {userName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0] ?? "")
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-secondary font-medium text-text-primary">
                {userName}
              </span>
              <span className="block truncate text-caption text-text-secondary">
                {roleName}
              </span>
            </span>
          </div>
          <Link
            href="/account"
            aria-current={isActiveNav("/account", pathname) ? "page" : undefined}
            className={cn(
              "mt-2 flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-body",
              isActiveNav("/account", pathname)
                ? "bg-brand-primary-subtle font-semibold text-brand-primary"
                : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
            )}
          >
            <KeyRound aria-hidden="true" className="size-5 shrink-0" />
            Account
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-body text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
            >
              <LogOut aria-hidden="true" className="size-5 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </Drawer>
    </>
  );
}
