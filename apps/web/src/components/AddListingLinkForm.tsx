"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";

type Props = { t: Messages };
type Message = { kind: "ok" | "error"; text: string };

export function AddListingLinkForm({ t }: Props) {
  const l = t.listings;
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        setUrl("");
        setMessage({ kind: "ok", text: l.added });
        router.refresh();
        return;
      }
      let code: string | undefined;
      try {
        code = ((await res.json()) as { error?: { code?: string } })?.error?.code;
      } catch {
        /* non-JSON error body */
      }
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      setMessage({ kind: "error", text: errorText(t, code) });
    } catch {
      setMessage({ kind: "error", text: errorText(t, "unavailable") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="files-filter" onSubmit={submit}>
      <div className="files-grid">
        <label className="files-field files-field--wide">
          <span>{l.linkLabel}</span>
          <input
            type="url"
            required
            maxLength={500}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={l.linkPlaceholder}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="files-actions">
        <button type="submit" className="files-btn files-btn--primary" disabled={busy || !url}>
          {busy ? l.adding : l.addButton}
        </button>
        {message ? (
          <span role={message.kind === "error" ? "alert" : "status"}>{message.text}</span>
        ) : null}
      </div>
    </form>
  );
}
