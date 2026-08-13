import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });

function AdminOverview() {
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: async () => {
    const [users, tickets, services, orders] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
      supabase.from("services").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return { users: users.count ?? 0, tickets: tickets.count ?? 0, services: services.count ?? 0, orders: orders.count ?? 0 };
  }});
  const cards = [["کاربران", data?.users ?? 0], ["تیکت‌های باز", data?.tickets ?? 0], ["سرویس‌ها", data?.services ?? 0], ["سفارش‌های در انتظار", data?.orders ?? 0]];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <section className="surface" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></section>)}</div>;
}
