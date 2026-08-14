import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/sponsors")({ component: AdminSponsors });

function AdminSponsors() {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-sponsors"], queryFn: async () => {
    const { data, error } = await supabase.from("sponsors").select("id, name, logo_url, website_url, is_active, sort").order("sort");
    if (error) throw error;
    return data ?? [];
  } });
  return <section className="surface"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">مدیریت اسپانسرها</h2><p className="mt-1 text-xs text-muted-foreground">لوگو و لینک اسپانسرهای فوتر سایت</p></div><button className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">افزودن اسپانسر</button></div><div className="mt-5 flex flex-col gap-2">{isLoading ? <p className="text-xs text-muted-foreground">در حال بارگذاری…</p> : data.map((sponsor) => <div key={sponsor.id} className="flex items-center justify-between rounded-lg border border-border p-3"><div className="flex items-center gap-3"><img src={sponsor.logo_url} alt={sponsor.name} className="size-8 rounded object-contain" /><div><p className="text-sm">{sponsor.name}</p><p className="text-[11px] text-muted-foreground">{sponsor.website_url || "بدون لینک"}</p></div></div><span className="text-[11px] text-muted-foreground">{sponsor.is_active ? "فعال" : "غیرفعال"}</span></div>)}</div></section>;
}
