import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { formatNumber } from "@/lib/format";
import { uiQuery, type FileFilters } from "@/lib/propertyQuery";

type Props = { locale: Locale; t: Messages; filters: FileFilters; page: number; totalPages: number };

export function Pagination({ locale, t, filters, page, totalPages }: Props) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const qs = uiQuery(filters, p);
    return `/${locale}/files${qs ? `?${qs}` : ""}`;
  };
  const info = t.files.pageOf
    .replace("{page}", formatNumber(page, locale, 0))
    .replace("{pages}", formatNumber(totalPages, locale, 0));

  return (
    <nav className="files-pager" aria-label={t.files.pagination}>
      {page > 1 ? (
        <Link className="files-btn" href={href(page - 1)} rel="prev">{t.files.prev}</Link>
      ) : (
        <span className="files-btn files-btn--off" aria-disabled="true">{t.files.prev}</span>
      )}
      <span>{info}</span>
      {page < totalPages ? (
        <Link className="files-btn" href={href(page + 1)} rel="next">{t.files.next}</Link>
      ) : (
        <span className="files-btn files-btn--off" aria-disabled="true">{t.files.next}</span>
      )}
    </nav>
  );
}