"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ locale, label }: { locale: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace(`/${locale}/login`);
      router.refresh();
    }
  }

  return (
    <button type="button" className="btn" onClick={logout} disabled={busy}>
      {label}
    </button>
  );
}
