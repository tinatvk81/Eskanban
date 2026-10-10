"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";

export function LoginForm({ locale, t }: { locale: Locale; t: Messages }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim() || !password) {
      setError(t.errors.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const retry = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
        setError(errorText(t, body?.error?.code, Number.isFinite(retry) ? retry : null));
        return;
      }
      const body = (await res.json()) as { mustChangePassword: boolean };
      router.replace(body.mustChangePassword ? `/${locale}/change-password` : `/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(t.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={onSubmit} noValidate>
      <h1>{t.auth.loginTitle}</h1>
      <p className="muted">{t.auth.loginSubtitle}</p>

      <div className="field">
        <label htmlFor="phone">{t.auth.phone}</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder={t.auth.phoneHint}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={32}
          required
        />
      </div>

      <PasswordInput
        id="password"
        label={t.auth.password}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        showLabel={t.auth.showPassword}
        hideLabel={t.auth.hidePassword}
      />

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? t.auth.submitting : t.auth.submit}
      </button>
    </form>
  );
}
