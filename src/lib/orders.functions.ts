import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { AUTO_PAYMENT_MESSAGE, DAYS_PER_MONTH } from "@/lib/constants";

const orderSchema = z.object({
  planId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  kind: z.enum(["new", "renew", "upgrade", "intl"]),
  durationMonths: z.number().int().min(1).max(12),
  os: z.string().trim().min(2).max(40).default("Ubuntu 24.04"),
  addons: z.array(z.string().uuid()).max(10).default([]),
  serviceName: z.string().trim().min(2).max(40),
  receiptPath: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
});

function extractStoragePath(maybeUrl?: string | null) {
  if (!maybeUrl) return null;
  try {
    // If it's a URL (signed url), try to extract the pathname and locate the bucket path
    const url = new URL(maybeUrl);
    // Some signed URLs include the full path after the host, possibly with /storage/v1/object/public/... or /attachments/...
    const path = url.pathname.replace(/^\//, "");
    // Try to find attachments/ substring
    const idx = path.indexOf("attachments/");
    if (idx !== -1) return path.slice(idx + "attachments/".length);
    // Otherwise return the raw pathname
    return path;
  } catch {
    // Not a URL, treat as direct storage path like receipts/{userId}/...
    const asPath = maybeUrl;
    // If the client passed a leading slash, remove it
    return asPath.replace(/^\//, "");
  }
}

/**
 * Creates a purchase/renewal order, opens the payment ticket, and posts the
 * automated "سیستم هوشمند دیارا" reply. Amount is computed server-side from the
 * database so the client cannot influence the price.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, network_name, email")
      .eq("id", userId)
      .maybeSingle();

    let amount = 0;
    let datacenterId: string | null = null;
    let bandwidth = 0;

    if (data.kind === "intl") {
      const { data: settings } = await supabaseAdmin
        .from("site_settings")
        .select("value")
        .eq("key", "payment")
        .maybeSingle();
      const value = (settings?.value ?? {}) as Record<string, unknown>;
      amount =
        (typeof value["intl_price"] === "number" ? (value["intl_price"] as number) : 180000) *
        data.durationMonths;
    } else {
      if (!data.planId) return { ok: false as const, error: "پلن انتخاب نشده است." };
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("*, datacenters(is_active, coming_soon)")
        .eq("id", data.planId)
        .maybeSingle();
      if (!plan || !plan.is_active || plan.is_locked) {
        return { ok: false as const, error: "این پلن در حال حاضر قابل سفارش نیست." };
      }
      const dc = plan.datacenters as { is_active: boolean; coming_soon: boolean } | null;
      if (dc && (!dc.is_active || dc.coming_soon)) {
        return { ok: false as const, error: "این دیتاسنتر فعلا فعال نیست." };
      }
      amount = plan.price * data.durationMonths;
      datacenterId = plan.datacenter_id;
      bandwidth = plan.bandwidth_gb;

      if (data.addons.length > 0) {
        const { data: addons } = await supabaseAdmin
          .from("addons")
          .select("price, is_active, is_locked")
          .in("id", data.addons);
        for (const addon of addons ?? []) {
          if (addon.is_active && !addon.is_locked) amount += addon.price * data.durationMonths;
        }
      }
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        plan_id: data.planId ?? null,
        service_id: data.serviceId ?? null,
        datacenter_id: datacenterId,
        kind: data.kind,
        duration_months: data.durationMonths,
        os: data.os,
        addons: data.addons,
        amount,
        service_name: data.serviceName,
        status: "pending",
      })
      .select("id, code")
      .single();
    if (orderError || !order) return { ok: false as const, error: "ثبت سفارش انجام نشد." };

    const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "کاربر";
    const kindLabel =
      data.kind === "renew"
        ? "تمدید سرویس"
        : data.kind === "intl"
        ? "اینترنت بین‌الملل"
        : data.kind === "upgrade"
        ? "ارتقای سرویس"
        : "خرید ابرک";

    // Ticket + messages creation must be atomic-ish: if messages fail, cleanup uploaded
    // receipt (if any) and rollback the created order to avoid orphans.
    try {
      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from("tickets")
        .insert({
          user_id: userId,
          order_id: order.id,
          service_id: data.serviceId ?? null,
          subject: `${kindLabel} — ${data.serviceName} (${order.code})`,
          department: "payment",
          priority: "high",
          status: "open",
        })
        .select("id, code")
        .single();

      if (ticketError || !ticket) throw ticketError ?? new Error("Ticket creation failed");

      const { error: messageError } = await supabaseAdmin.from("ticket_messages").insert([
        {
          ticket_id: ticket.id,
          sender_id: userId,
          sender_name: fullName,
          is_staff: false,
          body:
            `${kindLabel}\nنام سرویس: ${data.serviceName}\nمدت: ${data.durationMonths} ماه (${data.durationMonths * DAYS_PER_MONTH} روز)\nسیستم عامل: ${data.os}\nمبلغ: ${amount} تومان\nشبکه: ${profile?.network_name ?? "-"}` +
            (data.note ? `\nتوضیح: ${data.note}` : ""),
          attachment_path: data.receiptPath ?? null,
        },
        {
          ticket_id: ticket.id,
          sender_name: "سیستم هوشمند دیارا",
          is_staff: true,
          body: AUTO_PAYMENT_MESSAGE,
        },
      ]);

      if (messageError) throw messageError;

      await supabaseAdmin.from("orders").update({ ticket_id: ticket.id }).eq("id", order.id);

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: `سفارش ${order.code} ثبت شد`,
        body: AUTO_PAYMENT_MESSAGE,
        level: "info",
        link: "/dashboard/tickets",
      });

      return { ok: true as const, code: order.code, ticketCode: ticket?.code ?? null, amount };
    } catch (err) {
      console.error("[v0] Order/ticket flow failed:", err);

      // Attempt cleanup: remove uploaded receipt if present
      try {
        if (data.receiptPath) {
          const maybePath = extractStoragePath(data.receiptPath);
          if (maybePath) {
            // If extractStoragePath returned a path relative to attachments, remove it
            await supabaseAdmin.storage.from("attachments").remove([maybePath]);
          }
        }
      } catch (cleanupErr) {
        console.error("[v0] Cleanup failed:", cleanupErr);
      }

      // Rollback order
      try {
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
      } catch (delErr) {
        console.error("[v0] Order rollback failed:", delErr);
      }

      return { ok: false as const, error: "ثبت سفارش انجام نشد. لطفا دوباره تلاش کنید." };
    }
  });
