import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { describeChange, formatDateTime } from "@/lib/propertyDetail";
import type { HistoryEntry } from "@/lib/propertyTypes";

type Props = { entries: HistoryEntry[] | null; locale: Locale; t: Messages };

export function PropertyHistory({ entries, locale, t }: Props) {
  const d = t.fileDetail;
  return (
    <section className="card detail-section" aria-labelledby="file-history-title">
      <h2 id="file-history-title">{d.sections.history}</h2>
      {entries === null ? (
        <p className="files-muted">{d.historyUnavailable}</p>
      ) : entries.length === 0 ? (
        <p className="files-muted">{d.historyEmpty}</p>
      ) : (
        <ol className="detail-history">
          {entries.map((e) => {
            const changes = Object.entries(e.changes ?? {});
            return (
              <li key={e.id}>
                <div>
                  <span className="files-badge">{e.action}</span>
                  <span>{e.user.full_name}</span>
                  <span className="files-muted"> — {formatDateTime(e.created_at, locale) ?? ""}</span>
                </div>
                {changes.length === 0 ? (
                  <span className="files-muted">{d.noChanges}</span>
                ) : (
                  <ul className="detail-changes">
                    {changes.map(([field, value]) => (
                      <li key={field}>
                        <bdi dir="ltr"><code>{field}</code></bdi>: <bdi>{describeChange(value)}</bdi>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
