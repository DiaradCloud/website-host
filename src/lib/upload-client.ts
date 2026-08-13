import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "@/lib/uploads.functions";

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif"] as const;
type Ext = (typeof ALLOWED)[number];

/** Uploads an image to a private bucket through a server-issued signed URL. */
export async function uploadImage(
  bucket: "attachments" | "blog",
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: "حجم فایل باید کمتر از ۶ مگابایت باشد." };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED.includes(ext as Ext)) return { ok: false, error: "فقط تصویر jpg/png/webp مجاز است." };

  const signed = await createUploadUrl({ data: { bucket, ext: ext as Ext } });
  if (!signed.ok) return { ok: false, error: signed.error };

  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(signed.path, signed.token, file);
  if (error) return { ok: false, error: "آپلود فایل انجام نشد." };
  return { ok: true, path: signed.path };
}
