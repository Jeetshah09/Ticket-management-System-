import {
  LayoutDashboard,
  Ticket,
  Bell,
  User,
  Users,
  Tags,
  ScrollText,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles that see this item. Omit for everyone. */
  roles?: Role[];
  /** Match the href exactly (for /tickets index). */
  exact?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Role-aware navigation. Labels adapt to the signed-in role so the
 * customer sees "My Tickets" while agents/admins see "Ticket Queue".
 * Backend permissions remain authoritative for data access.
 */
export function getNavSections(role: Role): NavSection[] {
  const main: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
    role === "customer"
      ? { label: "My Tickets", href: "/tickets", icon: Ticket, exact: true }
      : { label: "Ticket Queue", href: "/tickets", icon: Ticket, exact: true },
    ...(role === "customer"
      ? [{ label: "New Ticket", href: "/tickets/new", icon: PlusCircle }]
      : []),
    { label: "Notifications", href: "/notifications", icon: Bell },
  ];

  const admin: NavItem[] = [
    { label: "Users", href: "/admin/users", icon: Users, roles: ["admin"] },
    { label: "Categories", href: "/admin/categories", icon: Tags, roles: ["admin"] },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, roles: ["admin"] },
  ];

  const sections: NavSection[] = [{ items: main }];

  if (role === "admin") {
    sections.push({ title: "Administration", items: admin });
  }

  sections.push({
    title: "Account",
    items: [{ label: "Profile", href: "/profile", icon: User }],
  });

  return sections;
}

export const PROFILE_NAV: NavItem = {
  label: "Profile",
  href: "/profile",
  icon: User,
};
