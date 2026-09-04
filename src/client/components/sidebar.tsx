import {
  Building2,
  Users,
  ClipboardList,
  Wrench,
  Settings,
  LayoutDashboard,
  Receipt,
  Home,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  /** Section prefix that keeps the item lit on detail pages. */
  section: string;
}

const sections: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Portfolio",
    items: [
      { label: "Dashboard",   icon: LayoutDashboard, path: "/dashboard",  section: "/dashboard" },
      { label: "Properties",  icon: Building2,       path: "/properties", section: "/properties" },
      { label: "Tenants",     icon: Users,           path: "/tenants",    section: "/tenants" },
      { label: "Leases",      icon: ClipboardList,   path: "/leases",     section: "/leases" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Rent",         icon: Receipt, path: "/rent",        section: "/rent" },
      { label: "Maintenance",  icon: Wrench,  path: "/maintenance", section: "/maintenance" },
    ],
  },
  {
    heading: "Admin",
    items: [
      { label: "Settings", icon: Settings, path: "/settings", section: "/settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Home className="h-4 w-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">OpenProperty</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.heading} className="mb-4">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.heading}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === "/"
                  ? item.section === "/dashboard"
                  : pathname === item.section || pathname.startsWith(`${item.section}/`);
                return (
                  <li key={item.label}>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active && "bg-sidebar-accent text-sidebar-accent-foreground",
                        !active && "hover:bg-sidebar-accent/60",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
