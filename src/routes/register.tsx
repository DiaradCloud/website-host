import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/logo";
import { registerUser } from "@/lib/accounts.functions";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/constants";
import { Field } from "@/routes/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "ثبت‌نام — دیاراد کلود" },
      {
        name: "description",
        content: "ساخت حساب کاربری دیاراد کلود و انتخاب نام شبکه اختصاصی زیر دامنه diarad.2bd.net.",
      },
      { property: "og:title", content: "ثبت‌نام — دیاراد کلود" },
      { property: "og:description", content: "حساب بسازید و اولین ابرک خود را سفارش دهید." },
    ],
  }),
  component: RegisterPage,
});

export default function noop() {}

function RegisterPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nationalId: "",
    phone: "",
    birthDate: "",
    city: "",
    networkName: "",
    email: "",
    password: "",
    confirm: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("رمز عبور و تکرار آن یکسان نیستند.");
      return;
    }
    setBusy(true);
    try {
      const result = await registerUser({
        data: {
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          nationalId: form.nationalId,
          phone: form.phone,
          birthDate: form.birthDate,
          city: form.city,
          networkName: form.networkName,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (error) {
        toast.success("ثبت‌نام انجام شد. وارد شوید.");
        navigate({ to: "/auth" });
        return;
      }
      toast.success("حساب شما ساخته شد");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      console.error(error);
      toast.error("اطلاعات وارد شده معتبر نیست. لطفا بازبینی کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <Link to="/" className="mb-8 flex justify-center">
          <BrandMark />
        </Link>
        <div className="surface">
          <h1 className="text-lg font-semibold">ساخت حساب کاربری</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            اطلاعات هویتی برای تحویل سرویس لازم است و به صورت امن ذخیره می‌شود.
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
            <Field label="نام">
              <input required minLength={2} value={form.firstName} onChange={set("firstName")} className="field" />
            </Field>
            <Field label="نام خانوادگی">
              <input required minLength={2} value={form.lastName} onChange={set("lastName")} className="field" />
            </Field>
            <Field label="کد ملی">
              <input
                required
                dir="ltr"
                inputMode="numeric"
                pattern="\d{10}"
                value={form.nationalId}
                onChange={set("nationalId")}
                className="field"
                placeholder="۱۰ رقم"
              />
            </Field>
            <Field label="شماره تماس">
              <input
                required
                dir="ltr"
                inputMode="numeric"
                pattern="0\d{10}"
                value={form.phone}
                onChange={set("phone")}
                className="field"
                placeholder="09xxxxxxxxx"
              />
            </Field>
            <Field label="تاریخ تولد" hint="نمونه: ۱۳۷۸/۰۵/۱۲">
              <input required value={form.birthDate} onChange={set("birthDate")} className="field" />
            </Field>
            <Field label="شهر">
              <input required value={form.city} onChange={set("city")} className="field" />
            </Field>
            <Field
              label="نام شبکه"
              hint={`آدرس شبکه شما: ${form.networkName || "net1"}.${BRAND.domain}`}
            >
              <input
                required
                dir="ltr"
                pattern="[a-z0-9][a-z0-9-]{1,20}"
                value={form.networkName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, networkName: e.target.value.toLowerCase() }))
                }
                className="field"
                placeholder="net1"
              />
            </Field>
            <Field label="ایمیل">
              <input required type="email" dir="ltr" value={form.email} onChange={set("email")} className="field" />
            </Field>
            <Field label="رمز عبور" hint="حداقل ۸ کاراکتر">
              <input
                required
                type="password"
                dir="ltr"
                minLength={8}
                value={form.password}
                onChange={set("password")}
                className="field"
              />
            </Field>
            <Field label="تکرار رمز عبور">
              <input
                required
                type="password"
                dir="ltr"
                minLength={8}
                value={form.confirm}
                onChange={set("confirm")}
                className="field"
              />
            </Field>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "در حال ثبت…" : "ثبت‌نام"}
              </button>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                حساب دارید؟{" "}
                <Link to="/auth" className="text-primary">
                  ورود
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
