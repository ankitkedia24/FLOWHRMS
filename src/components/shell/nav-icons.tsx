import {
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  CircleUser,
  Clock,
  FileClock,
  FileText,
  History,
  House,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Network,
  ReceiptIndianRupee,
  ScrollText,
  ShieldCheck,
  ToggleRight,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIcon } from "@/lib/shell/nav";

/**
 * Icon name → component. Kept apart from `lib/shell/nav.ts` so that module
 * stays pure and testable in node, with no React or lucide import.
 *
 * Lucide throughout, `currentColor`, per icon-style-guide.md.
 */
export const NAV_ICONS: Record<NavIcon, typeof Clock> = {
  dashboard: LayoutDashboard,
  attendance: Clock,
  employees: Users,
  leave: CalendarDays,
  tasks: ListChecks,
  payroll: ReceiptIndianRupee,
  dailyReport: FileClock,
  reports: ChartNoAxesColumn,
  home: House,
  profile: CircleUser,
  documents: FileText,
  payslips: ReceiptIndianRupee,
  modules: ToggleRight,
  roles: ShieldCheck,
  rules: ScrollText,
  company: Building2,
  departments: Network,
  activity: History,
  performance: Trophy,
  expenses: Wallet,
  account: KeyRound,
};
