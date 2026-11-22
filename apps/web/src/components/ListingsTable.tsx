"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";
import { formatToman, labelOf } from "@/lib/format";
import type { ListingRow } from "@/lib/listingTypes";
import type { VocabMap } from "@/lib/propertyTypes";

type Props = { rows: ListingRow[]; vocab: VocabMap; locale: Locale; t: Messages };

async function call(listingId: string, action: string, body?: unknown) {
  try {
    const res = await fetch(`/api/listings/${listingId}/${action}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true as const };
    let code: string | undefined;
    try {
      code = ((await res.json()) as { error?: { code?: string } })?.error?.code;
    } catch {
      /* non-JSON error body */
    }
    return { ok: false as const, status: res.status, code };
  } catch {
    return { ok: false as const, status: 503, code: "unavailable" };
  }
}

function ConvertRow({
  row,
  locale,
  t,
  vocab,
  onDone,
}: {
  row: ListingRow;
  locale: Locale;
  t: Messages;
  vocab: VocabMap;
  onDone: () => void;
}) {
  const l = t.listings;
  const router = useRouter();
  const [dealType, setDealType] = useState(row.deal_type ?? "");
  const [cityId, setCityId] = useState(row.city_id ? String(row.city_id) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cityNum = Number(cityId);
    if (!dealType || !Number.isSafeInteger(cityNum) || cityNum <= 0) {
      setError(l.convertMissing);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await call(row.id, "convert", { deal_type: dealType, city_id: cityNum });
    setBusy(false);
    if (result.ok) {
      onDone();
      router.refresh();
      return;
    }
    if (result.status === 401) {
      router.replace(`/${locale}/login`);
      return;
    }
    setError(errorText(t, result.code));
  }

  return (
    <form onSubmit={submit} className="files-grid" style={{ marginBlockStart: "0.5rem" }}>
      <label className="files-field">
        <span>{l.dealTypeLabel}</span>
        <select value={dealType} onChange={(e) => setDealType(e.target.value)}>
          <option value="">{l.choose}</option>
          {(vocab.deal_types ?? []).map((i) => (
            <option key={i.key} value={i.key}>
              {i[locale]}
            </option>
          ))}
        </select>
      </label>
      <label className="files-field">
        <span>{l.cityIdLabel}</span>
        <input
          type="text"
          inputMode="numeric"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          placeholder={l.cityIdPlaceholder}
        />
      </label>
      <div className="files-actions">
        <button type="submit" className="files-btn files-btn--primary" disabled={busy}>
          {busy ? l.converting : l.convertConfirm}
        </button>
        {error ? <span role="alert">{error}</span> : null}
      </div>
    </form>
  );
}

export function ListingsTable({ rows, vocab, locale, t }: Props) {
  const l = t.listings;
  const router = useRouter();
  const [openConvert, setOpenConvert] = useState<string | null>(null);
  const [busyDismiss, setBusyDismiss] = useState<string | null>(null);

  async function dismiss(id: string) {
    setBusyDismiss(id);
    const result = await call(id, "dismiss");
    setBusyDismiss(null);
    if (result.ok) {
      router.refresh();
      return;
    }
    if (result.status === 401) {
      router.replace(`/${locale}/login`);
    }
  }

  return (
    <div className="files-table-wrap">
      <table className="files-table">
        <caption className="files-sr">{l.title}</caption>
        <thead>
          <tr>
            <th scope="col">{l.columns.source}</th>
            <th scope="col">{l.columns.title}</th>
            <th scope="col">{l.columns.owner}</th>
            <th scope="col">{l.columns.price}</th>
            <th scope="col">{l.columns.status}</th>
            <th scope="col">{l.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td data-label={l.columns.source}>
                <span className="files-badge">{row.source}</span>
                <div>
                  <a href={row.url} target="_blank" rel="noreferrer noopener" className="files-link">
                    {l.viewOriginal}
                  </a>
                </div>
              </td>
              <td data-label={l.columns.title}>
                {row.title ?? "—"}
                {row.district ? <div className="files-muted">{row.district}</div> : null}
                {row.deal_type ? (
                  <div>{labelOf(vocab.deal_types, row.deal_type, locale)}</div>
                ) : null}
              </td>
              <td data-label={l.columns.owner}>
                {row.owner_name ?? "—"}
                {row.owner_phone ? <div className="files-muted">{row.owner_phone}</div> : null}
              </td>
              <td data-label={l.columns.price}>
                {row.price_total
                  ? formatToman(row.price_total, locale, t.files.units)
                  : row.monthly_rent
                    ? formatToman(row.monthly_rent, locale, t.files.units)
                    : "—"}
              </td>
              <td data-label={l.columns.status}>{l.statusLabel[row.status]}</td>
              <td data-label={l.columns.actions}>
                {row.status === "new" ? (
                  <div className="files-actions">
                    <button
                      type="button"
                      className="files-btn"
                      disabled={busyDismiss === row.id}
                      onClick={() => dismiss(row.id)}
                    >
                      {l.dismiss}
                    </button>
                    <button
                      type="button"
                      className="files-btn files-btn--primary"
                      onClick={() => setOpenConvert(openConvert === row.id ? null : row.id)}
                    >
                      {l.convert}
                    </button>
                  </div>
                ) : row.status === "converted" && row.converted_property_id ? (
                  <a className="files-link" href={`/${locale}/files/${row.converted_property_id}`}>
                    {l.openFile}
                  </a>
                ) : (
                  <span className="files-muted">{l.statusLabel[row.status]}</span>
                )}
                {openConvert === row.id ? (
                  <ConvertRow
                    row={row}
                    locale={locale}
                    t={t}
                    vocab={vocab}
                    onDone={() => setOpenConvert(null)}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
