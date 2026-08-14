import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  filename: z.string().trim().min(1).max(160),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
  body: z.string().min(1),
});

export const uploadReceiptToBlob = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    try {
      const { put } = await import("@vercel/blob");
      const raw = data.body.includes(",") ? data.body.split(",", 2)[1] : data.body;
      const bytes = Buffer.from(raw, "base64");
      if (bytes.byteLength > 6 * 1024 * 1024) {
        return { ok: false as const, error: "حجم رسید باید کمتر از ۶ مگابایت باشد." };
      }

      const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const blob = await put(`receipts/${crypto.randomUUID()}-${safeName}`, bytes, {
        access: "private",
        contentType: data.contentType,
        addRandomSuffix: false,
      });

      return { ok: true as const, url: blob.url, pathname: blob.pathname };
    } catch (error) {
      console.error("[v0] Blob receipt upload failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (/BLOB_READ_WRITE_TOKEN|token|credential/i.test(message)) {
        return { ok: false as const, error: "فضای ذخیره‌سازی فایل روی سرور تنظیم نشده است. متغیر BLOB_READ_WRITE_TOKEN را بررسی کنید." };
      }
      return { ok: false as const, error: `آپلود رسید انجام نشد: ${message}` };
    }
  });
