import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { formatArea, formatToman, labelOf } from "@/lib/format";
import type { PropertyRow, VocabMap } from "@/lib/propertyTypes";

type Props = { rows: PropertyRow[]; vocab: VocabMap; locale: Locale; t: Messages };

function PriceCell({ row, locale, t }: { row: PropertyRow; locale: Locale; t: Messages }) {
  const f = t.files;
  const money = (v: number | null) => formatToman(v, locale, f.units);
  if (row.deal_type === "rent") {
    return (
      <>
        <div>{f.deposit}: {money(row.deposit)}</div>
        <div>{f.monthlyRent}: {money(row.monthly_rent)}</div>
      </>
    );
  }
  if (row.deal_type === "mortgage") return <div>{f.deposit}: {money(row.deposit)}</div>;
  return <div>{money(row.price_total)}</div>;
}

export function FilesTable({ rows, vocab, locale, t }: Props) {
  const f = t.files;
  return (
    <div className="files-table-wrap">
      <table className="files-table">
        <caption className="files-sr">{f.title}</caption>
        <thead>
          <tr>
            <th scope="col">{f.columns.kind}</th>
            <th scope="col">{f.columns.location}</th>
            <th scope="col">{f.columns.area}</th>
            <th scope="col">{f.columns.rooms}</th>
            <th scope="col">{f.columns.price}</th>
            <th scope="col">{f.columns.advisor}</th>
            <th scope="col">{f.columns.flags}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td data-label={f.columns.kind}>
                <span className="files-badge">{labelOf(vocab.deal_types, row.deal_type, locale)}</span>
                <div>
                  {row.property_types.map((k) => labelOf(vocab.property_types, k, locale)).join("، ")}
                </div>
              </td>
              <td data-label={f.columns.location}>
                {row.city.name}
                {row.district ? <div className="files-muted">{row.district}</div> : null}
              </td>
              <td data-label={f.columns.area}>{formatArea(row.main_area_m2, locale, f.units.meter)}</td>
              <td data-label={f.columns.rooms}>{row.rooms ?? "—"}</td>
              <td data-label={f.columns.price}><PriceCell row={row} locale={locale} t={t} /></td>
              <td data-label={f.columns.advisor}>{row.owner.full_name}</td>
              <td data-label={f.columns.flags}>
                {row.is_urgent_now ? <span className="files-badge files-badge--urgent">{f.urgent}</span> : null}
                {row.shared_with_agency ? <span className="files-badge">{f.shared}</span> : null}
                {row.is_favorite ? <span className="files-badge">★ {f.favorite}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}