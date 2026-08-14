import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, LifeBuoy, LockKeyhole, Package, Server, Users } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PanelLayout } from "@/components/site/panel-shell";
import { hasStandaloneAdminSession } from "@/lib/admin-session";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "مدیریت — دیاراد کلود" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "داشبورد", icon: <LayoutDashboard className="size-4" />, exact: true },
  { to: "/admin/tickets", label: "تیکت‌ها", icon: <LifeBuoy className="size-4" /> },
  { to: "/admin/users", label: "کاربران", icon: <Users className="size-4" /> },
  { to: "/admin/services", label: "سرویس‌ها", icon: <Server className="size-4" /> },
  { to: "/admin/catalog", label: "کاتالوگ و قفل‌ها", icon: <Package className="size-4" /> },
  { to: "/admin/security", label: "امنیت حساب‌ها", icon: <LockKeyhole className="size-4" /> },
];

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLoginRoute = pathname === "/admin/panel" || pathname === "/admin/login";
  const authorized = hasStandaloneAdminSession();

  useEffect(() => {
    if (!isLoginRoute && !authorized) void navigate({ to: "/admin/panel", replace: true });
  }, [authorized, isLoginRoute, navigate]);

  if (isLoginRoute) return <Outlet />;
  if (!authorized) return <div className="min-h-screen" aria-busy="true" />;

  return <div className="min-h-screen"><SiteHeader /><main className="pt-14"><PanelLayout title="کنسول مدیریت" subtitle="مدیریت کاربران، پشتیبانی، سرویس‌ها و قفل‌های فروش" nav={NAV}><Outlet /></PanelLayout></main><SiteFooter /></div>;
}
