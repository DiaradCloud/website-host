import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "@/lib/uploads.functions";
import { clearStaleSession, isStaleSessionError } from "@/lib/auth-recovery";

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif"] as const;
type Ext = (typeof ALLOWED)[number];

const SESSION_EXPIRED_ERROR = "نشست شما منقضی شده است. صفحه را ببندید و دوباره وارد حساب شوید.";

/** Uploads an image to a private bucket through a server-issued signed URL. */
export async function uploadImage(
  bucket: "ticket-attachments" | "blog",
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: "حجم فایل باید کمتر از ۶ مگابایت باشد." };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED.includes(ext as Ext)) return { ok: false, error: "فقط تصویر jpg/png/webp مجاز است." };

  try {
    const signed = await createUploadUrl({ data: { bucket, ext: ext as Ext } });
    if (!signed.ok) return { ok: false, error: signed.error };
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(signed.path, signed.token, file);
    if (error) {
      console.error("[v0] Signed upload failed:", error.message, error.name);
      if (isStaleSessionError(error)) {
        await clearStaleSession();
        return { ok: false, error: SESSION_EXPIRED_ERROR };
      }
      return { ok: false, error: "آپلود فایل انجام نشد. دوباره تلاش کنید." };
    }
    return { ok: true, path: signed.path };
  } catch (error) {
    console.error("[v0] Upload request failed:", error);
    if (isStaleSessionError(error)) {
      await clearStaleSession();
      return { ok: false, error: SESSION_EXPIRED_ERROR };
    }
    return { ok: false, error: "آپلود فایل انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید." };
  }
}
