"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";

export function ChangePasswordForm({ locale, t }: { locale: Locale; t: Messages }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!current || !next || !repeat) return setError(t.errors.required);
    if (next !== repeat) return setError(t.errors.mismatch);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.status === 401) {
        router.replace(`/${locale}/login`);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(errorText(t, body?.error?.code));
        return;
      }
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(t.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={onSubmit} noValidate>
      <h1>{t.auth.changeTitle}</h1>
      <p className="muted">{t.auth.changeIntro}</p>

      <PasswordInput
        id="current-password"
        label={t.auth.currentPassword}
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        showLabel={t.auth.showPassword}
        hideLabel={t.auth.hidePassword}
      />
      <PasswordInput
        id="new-password"
        label={t.auth.newPassword}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        showLabel={t.auth.showPassword}
        hideLabel={t.auth.hidePassword}
      />
      <p className="hint">{t.auth.passwordRules}</p>
      <PasswordInput
        id="repeat-password"
        label={t.auth.repeatPassword}
        value={repeat}
        onChange={setRepeat}
        autoComplete="new-password"
        showLabel={t.auth.showPassword}
        hideLabel={t.auth.hidePassword}
      />

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? t.auth.saving : t.auth.save}
      </button>
    </form>
  );
}
