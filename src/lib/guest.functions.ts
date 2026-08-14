import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const guestTicketSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
  attachmentPath: z.string().trim().max(2000).optional(),
});

/**
 * Public "forgot password" ticket. Guests cannot write to the tickets table
 * directly; this endpoint validates the payload server-side and stores it.
 */
export const createGuestTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => guestTicketSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .insert({
        user_id: profile?.id ?? null,
        guest_email: email,
        subject: `فراموشی رمز عبور — ${data.fullName}`,
        department: "password",
        priority: "high",
        status: "open",
      })
      .select("id, code")
      .single();

    if (error || !ticket) return { ok: false as const, error: "ارسال تیکت انجام نشد." };

    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: profile?.id ?? null,
      sender_name: data.fullName,
      body: data.body,
      attachment_path: data.attachmentPath ?? null,
      is_staff: false,
    });

    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_name: "سیستم هوشمند دیارا",
      is_staff: true,
      body:
        "درود. من سیستم هوشمند دیارا هستم. درخواست بازیابی رمز شما ثبت شد و پس از بررسی مدارک، رمز جدید به ایمیل شما ارسال می‌شود. باتشکر. تیم پشتیبانی دیارا",
    });

    return { ok: true as const, code: ticket.code };
  });

/**
 * Guest upload endpoint: accepts a base64 body and either uploads to a blob
 * provider (if token is available) or returns the inline data URL. This avoids
 * requiring a Supabase service role key for guests.
 */
export const guestUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(160),
        contentType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
        body: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const raw = data.body.includes(",") ? data.body.split(",", 2)[1] : data.body;
      const bytes = Buffer.from(raw, "base64");
      if (bytes.byteLength > 6 * 1024 * 1024) {
        return { ok: false as const, error: "حجم تصویر باید کمتر از ۶ مگابایت باشد." };
      }

      const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `guest/${crypto.randomUUID()}-${safeName}`;

      const blobToken = process.env["BLOB_READ_WRITE_TOKEN"] || process.env["VERCEL_BLOB_READ_WRITE_TOKEN"];
      if (blobToken) {
        try {
          const { put } = await import("@vercel/blob");
          const blob = await put(path, bytes, {
            access: "private",
            contentType: data.contentType,
            addRandomSuffix: false,
          });
          return { ok: true as const, url: blob.url, pathname: path };
        } catch (blobErr) {
          console.error("[v0] Vercel Blob put failed (guest):", blobErr);
          // fall through to inline data URL
        }
      }

      const dataUrl = `data:${data.contentType};base64,${raw}`;
      return { ok: true as const, url: dataUrl, pathname: null };
    } catch (err) {
      console.error("[v0] guestUploadUrl failed:", err);
      return { ok: false as const, error: "آپلود در دسترس نیست." };
    }
  });
