import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

const input = z.object({
  filename: z.string().trim().min(1).max(160),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
  body: z.string().min(1),
});

export const uploadReceiptToBlob = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    try {
      // Validate authorization header and resolve the user ID server-side.
      const req = getRequest();
      const authHeader = req?.headers?.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { ok: false as const, error: "Unauthorized: No authorization header provided" };
      }
      const token = authHeader.replace("Bearer ", "");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Validate token and get user
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !userData?.user) {
        console.error("[v0] Supabase token verification failed (blob upload):", userErr?.message ?? userErr);
        return { ok: false as const, error: "Unauthorized: Invalid token" };
      }
      const userId = userData.user.id;

      // Decode base64 body
      const raw = data.body.includes(",") ? data.body.split(",", 2)[1] : data.body;
      const bytes = Buffer.from(raw, "base64");
      if (bytes.byteLength > 6 * 1024 * 1024) {
        return { ok: false as const, error: "حجم رسید باید کمتر از ۶ مگابایت باشد." };
      }

      const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `receipts/${userId}/${crypto.randomUUID()}-${safeName}`;

      // Upload directly to Supabase storage using the Admin client (service role key).
      const { error: uploadErr } = await supabaseAdmin.storage.from("attachments").upload(path, bytes, {
        contentType: data.contentType,
        upsert: false,
      });
      if (uploadErr) {
        console.error("[v0] Supabase storage upload failed:", uploadErr.message);
        return { ok: false as const, error: "آپلود رسید انجام نشد: " + uploadErr.message };
      }

      // Create a signed URL for reading
      const { data: signed } = await supabaseAdmin.storage.from("attachments").createSignedUrl(path, 60 * 60);
      return { ok: true as const, url: signed?.signedUrl ?? null, pathname: path };
    } catch (error) {
      console.error("[v0] Blob receipt upload failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (/BLOB_READ_WRITE_TOKEN|token|credential/i.test(message)) {
        return { ok: false as const, error: "فضای ذخیره‌سازی فایل روی سرور تنظیم نشده است. متغیر مربوط به سرویس ذخیره را بررسی کنید." };
      }
      return { ok: false as const, error: `آپلود رسید انجام نشد: ${message}` };
    }
  });
