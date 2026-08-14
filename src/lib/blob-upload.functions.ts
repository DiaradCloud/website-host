import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({
  filename: z.string().trim().min(1).max(160),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
  body: z.string().min(1),
});

/**
 * Upload a receipt. Authenticated users only. We prefer Vercel Blob (fast) when
 * BLOB_READ_WRITE_TOKEN is set; otherwise we fallback to returning the Data URL
 * so the app can continue to use it inline (less ideal but works without extra secrets).
 */
export const uploadReceiptToBlob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data, context }) => {
    try {
      const userId = context.userId;

      // Decode base64 body
      const raw = data.body.includes(",") ? data.body.split(",", 2)[1] : data.body;
      const bytes = Buffer.from(raw, "base64");
      if (bytes.byteLength > 6 * 1024 * 1024) {
        return { ok: false as const, error: "حجم رسید باید کمتر از ۶ مگابایت باشد." };
      }

      const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `receipts/${userId}/${crypto.randomUUID()}-${safeName}`;

      const blobToken = process.env["BLOB_READ_WRITE_TOKEN"] || process.env["VERCEL_BLOB_READ_WRITE_TOKEN"];
      if (blobToken) {
        try {
          const { put } = await import("@vercel/blob");
          const blob = await put(path, bytes, {
            access: "private",
            contentType: data.contentType,
            addRandomSuffix: false,
            // The library reads token from env; ensure it picks it up.
          });
          // Return provider-specific pathname and a read URL
          return { ok: true as const, url: blob.url, pathname: path };
        } catch (blobErr) {
          console.error("[v0] Vercel Blob put failed:", blobErr);
          // Fallthrough to returning inline data URL as a last resort
        }
      }

      // Fallback: return the data URL so the client can embed it directly in the ticket.
      // This avoids requiring any storage secret but means the image will be stored in the DB as a data URL.
      const dataUrl = `data:${data.contentType};base64,${raw}`;
      return { ok: true as const, url: dataUrl, pathname: null };
    } catch (error) {
      console.error("[v0] Blob receipt upload failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false as const, error: `آپلود رسید انجام نشد: ${message}` };
    }
  });
