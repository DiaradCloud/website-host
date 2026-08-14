import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "@/lib/uploads.functions";

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif"] as const;
type Ext = (typeof ALLOWED)[number];

/** Uploads an image to a private bucket through a server-issued signed URL. */
export async function uploadImage(
  bucket: "ticket-attachments" | "blog",
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: "حجم فایل باید کمتر از ۶ مگابایت باشد." };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED.includes(ext as Ext)) return { ok: false, error: "فقط تصویر jpg/png/webp مجاز است." };

  try {
    if (bucket === "attachments") {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return { ok: false, error: "برای بارگذاری رسید باید وارد حساب شوید." };
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        console.error("[v0] Direct receipt upload failed:", error.message, error.name);
        return { ok: false, error: "آپلود رسید انجام نشد. دسترسی فضای ذخیره‌سازی را بررسی کنید." };
      }
      return { ok: true, path };
    }

    const signed = await createUploadUrl({ data: { bucket, ext: ext as Ext } });
    if (!signed.ok) return { ok: false, error: signed.error };
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(signed.path, signed.token, file);
    if (error) {
      console.error("[v0] Signed blog upload failed:", error.message, error.name);
      return { ok: false, error: "آپلود فایل انجام نشد. دوباره تلاش کنید." };
    }
    return { ok: true, path: signed.path };
  } catch (error) {
    console.error("[v0] Receipt upload request failed:", error);
    return { ok: false, error: "آپلود رسید انجام نشد. دوباره تلاش کنید." };
  }
}
