import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/blog")({ component: AdminBlog });

function AdminBlog() {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-blog"], queryFn: async () => {
    const { data, error } = await supabase.from("blog_posts").select("id, title, slug, tag, published, updated_at").order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } });
  return <section className="surface"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">ادیتور بلاگ</h2><p className="mt-1 text-xs text-muted-foreground">مدیریت مقاله‌ها، پیش‌نویس‌ها و انتشار</p></div><button className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">مقاله جدید</button></div><div className="mt-5 overflow-x-auto"><table className="w-full text-right text-xs"><thead className="text-muted-foreground"><tr><th className="pb-3">عنوان</th><th className="pb-3">دسته‌بندی</th><th className="pb-3">وضعیت</th><th className="pb-3">آخرین ویرایش</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={4} className="py-5 text-muted-foreground">در حال بارگذاری…</td></tr> : data.map((post) => <tr key={post.id} className="border-t border-border"><td className="py-3 font-medium">{post.title}</td><td className="py-3 text-muted-foreground">{post.tag || "عمومی"}</td><td className="py-3">{post.published ? "منتشر شده" : "پیش‌نویس"}</td><td className="py-3 text-muted-foreground">{new Date(post.updated_at).toLocaleDateString("fa-IR")}</td></tr>)}</tbody></table></div></section>;
}
