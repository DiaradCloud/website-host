import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, LifeBuoy, LockKeyhole, Package, Server, Users } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PanelLayout } from "@/components/site/panel-shell";
import { useSession } from "@/hooks/use-session";

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
  const { data: session, isLoading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !session?.isStaff) void router.navigate({ to: "/dashboard", replace: true });
  }, [isLoading, session?.isStaff, router]);

  return <div className="min-h-screen"><SiteHeader /><main className="pt-14">{isLoading ? <div className="shell py-16 text-sm text-muted-foreground">در حال بارگذاری…</div> : !session?.isStaff ? <div className="shell py-16"><p className="text-sm text-muted-foreground">دسترسی به این بخش مجاز نیست.</p><Link to="/dashboard" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">بازگشت به پنل</Link></div> : <PanelLayout title="کنسول مدیریت" subtitle="مدیریت کاربران، پشتیبانی، سرویس‌ها و قفل‌های فروش" nav={NAV}><Outlet /></PanelLayout>}</main><SiteFooter /></div>;
}
