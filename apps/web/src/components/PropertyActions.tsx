"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";
import type { VocabItem } from "@/lib/propertyTypes";

export type AdvisorOption = { id: string; full_name: string };

type Props = {
  locale: Locale;
  t: Messages;
  propertyId: string;
  status: string;
  isFavorite: boolean;
  isShared: boolean;
  ownerId: string;
  canEdit: boolean;
  isManager: boolean;
  statuses: VocabItem[];
  advisors: AdvisorOption[];
};

type Message = { kind: "ok" | "error"; text: string };
type CallResult = { ok: true } | { ok: false; status: number; code?: string };

async function call(propertyId: string, action: string, body?: unknown): Promise<CallResult> {
  try {
    const res = await fetch(`/api/properties/${propertyId}/${action}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    let code: string | undefined;
    try {
      code = ((await res.json()) as { error?: { code?: string } })?.error?.code;
    } catch {
      /* non-JSON error body */
    }
    return { ok: false, status: res.status, code };
  } catch {
    return { ok: false, status: 503, code: "unavailable" };
  }
}

export function PropertyActions({
  locale,
  t,
  propertyId,
  status,
  isFavorite,
  isShared,
  ownerId,
  canEdit,
  isManager,
  statuses,
  advisors,
}: Props) {
  const a = t.fileActions;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [nextStatus, setNextStatus] = useState(status);
  const [dealDate, setDealDate] = useState("");
  const [newOwner, setNewOwner] = useState(ownerId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: string, body?: unknown, leaveAfter = false) {
    setBusy(true);
    setMessage(null);
    const result = await call(propertyId, action, body);
    setBusy(false);
    if (result.ok) {
      if (leaveAfter) {
        router.replace(`/${locale}/files`);
        router.refresh();
        return;
      }
      setMessage({ kind: "ok", text: a.done });
      router.refresh();
      return;
    }
    if (result.status === 401) {
      router.replace(`/${locale}/login`);
      return;
    }
    setMessage({ kind: "error", text: errorText(t, result.code) });
  }

  return (
    <section className="card detail-section" aria-labelledby="file-actions-title">
      <h2 id="file-actions-title">{a.title}</h2>

      <div className="detail-actions">
        <div className="detail-action">
          <div className="detail-action-row">
            <button type="button" className="files-btn" disabled={busy} onClick={() => run("favorite")}>
              {isFavorite ? a.favoriteRemove : a.favoriteAdd}
            </button>
            {isManager ? (
              <button
                type="button"
                className="files-btn"
                disabled={busy}
                onClick={() => run("share", { shared: !isShared })}
              >
                {isShared ? a.shareOff : a.shareOn}
              </button>
            ) : null}
          </div>
        </div>

        {canEdit && statuses.length > 0 ? (
          <form
            className="detail-action"
            onSubmit={(e) => {
              e.preventDefault();
              void run("status", {
                status: nextStatus,
                deal_date: nextStatus === "closed" && dealDate ? dealDate : null,
              });
            }}
          >
            <div className="detail-action-row">
              <label className="files-field">
                <span>{a.statusLabel}</span>
                <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} disabled={busy}>
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>{s[locale]}</option>
                  ))}
                </select>
              </label>
              {nextStatus === "closed" ? (
                <label className="files-field">
                  <span>{a.dealDate}</span>
                  <input type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} disabled={busy} />
                </label>
              ) : null}
              <button
                type="submit"
                className="files-btn files-btn--primary"
                disabled={busy || nextStatus === status}
              >
                {a.statusSave}
              </button>
            </div>
          </form>
        ) : null}

        {isManager && advisors.length > 0 ? (
          <form
            className="detail-action"
            onSubmit={(e) => {
              e.preventDefault();
              void run("reassign", { owner_user_id: newOwner });
            }}
          >
            <div className="detail-action-row">
              <label className="files-field">
                <span>{a.reassignLabel}</span>
                <select value={newOwner} onChange={(e) => setNewOwner(e.target.value)} disabled={busy}>
                  {advisors.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="files-btn files-btn--primary"
                disabled={busy || newOwner === ownerId}
              >
                {a.reassignSave}
              </button>
            </div>
          </form>
        ) : null}

        {isManager ? (
          <div className="detail-action">
            {confirmDelete ? (
              <div className="detail-action-row" role="group" aria-label={a.delete}>
                <span>{a.deleteConfirm}</span>
                <button
                  type="button"
                  className="files-btn"
                  disabled={busy}
                  onClick={() => run("soft-delete", undefined, true)}
                >
                  {a.deleteYes}
                </button>
                <button type="button" className="files-btn" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  {a.cancel}
                </button>
              </div>
            ) : (
              <div className="detail-action-row">
                <button type="button" className="files-btn" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  {a.delete}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {busy ? <p className="files-muted" role="status">{a.working}</p> : null}
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "alert" : "files-muted"}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
