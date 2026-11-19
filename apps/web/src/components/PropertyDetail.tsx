import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { formatArea, formatNumber, formatToman, labelOf, toNumber } from "@/lib/format";
import {
  formatDate,
  formatDateTime,
  formatPlain,
  safeHttpUrl,
  telHref,
} from "@/lib/propertyDetail";
import type { PropertyDetail as Detail, VocabMap } from "@/lib/propertyTypes";

type Props = { property: Detail; vocab: VocabMap; locale: Locale; t: Messages };
type Row = [label: string, value: ReactNode];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (shown.length === 0) return null;
  return (
    <section className="card detail-section">
      <h2>{title}</h2>
      <dl className="detail-list">
        {shown.map(([label, value]) => (
          <div key={label} className="detail-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PropertyDetail({ property: p, vocab, locale, t }: Props) {
  const d = t.fileDetail;
  const f = d.fields;
  const sep = locale === "fa" ? "، " : ", ";

  const pick = (name: string, key: string | null) => (key ? labelOf(vocab[name], key, locale) : null);
  const yesNo = (v: boolean | null) => (v === null ? null : v ? d.yes : d.no);
  const money = (v: number | null) => (v === null ? null : formatToman(v, locale, t.files.units));
  const area = (v: number | string | null) =>
    toNumber(v) === null ? null : formatArea(v, locale, t.files.units.meter);

  const typeLabels = p.property_types.map((k) => labelOf(vocab.property_types, k, locale)).join(sep);
  const place = p.district ? `${p.city.name}${sep}${p.district}` : p.city.name;

  const amenities = [
    ...p.amenities.map((k) => labelOf(vocab.amenities, k, locale)),
    ...p.custom_amenities,
  ].join(sep);

  const mapUrl = safeHttpUrl(p.location_url);
  const tel = telHref(p.owner_phone);
  const hasOwnerInfo = p.owner_name !== null || p.owner_phone !== null;

  const priceRows: Row[] =
    p.deal_type === "rent"
      ? [[f.deposit, money(p.deposit)], [f.monthlyRent, money(p.monthly_rent)]]
      : p.deal_type === "mortgage"
        ? [[f.deposit, money(p.deposit)]]
        : [[f.price, money(p.price_total)], [f.pricePerM2, money(p.price_per_m2)]];

  return (
    <>
      <header className="detail-head">
        <h1>{typeLabels} — {place}</h1>
        <div>
          <span className="files-badge">{labelOf(vocab.deal_types, p.deal_type, locale)}</span>
          <span className="files-badge">{labelOf(vocab.statuses, p.status, locale)}</span>
          {p.is_urgent_now ? <span className="files-badge files-badge--urgent">{t.files.urgent}</span> : null}
          {p.shared_with_agency ? <span className="files-badge">{t.files.shared}</span> : null}
          {p.is_favorite ? <span className="files-badge">★ {t.files.favorite}</span> : null}
        </div>
      </header>

      <div className="detail-grid">
        <Section
          title={d.sections.overview}
          rows={[
            [f.status, pick("statuses", p.status)],
            [f.dealType, pick("deal_types", p.deal_type)],
            [f.advisor, p.owner.full_name],
            [f.dealDate, formatDate(p.deal_date, locale)],
            [f.urgent, p.is_urgent ? d.yes : null],
            [f.urgentUntil, formatDate(p.urgent_until, locale)],
            [f.shared, yesNo(p.shared_with_agency)],
          ]}
        />

        <Section
          title={d.sections.location}
          rows={[
            [f.city, `${p.city.province_name}${sep}${p.city.name}`],
            [f.district, p.district],
            [f.address, p.address],
            [
              f.locationLink,
              mapUrl ? (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="files-link">
                  {d.openMap}
                </a>
              ) : null,
            ],
          ]}
        />

        <Section
          title={d.sections.space}
          rows={[
            [f.landArea, area(p.land_area_m2)],
            [f.builtArea, area(p.built_area_m2)],
            [f.rooms, formatPlain(p.rooms, locale)],
            [f.floor, formatPlain(p.floor, locale)],
            [f.totalFloors, formatPlain(p.total_floors, locale)],
            [f.totalUnits, formatPlain(p.total_units, locale)],
            [f.buildYear, formatPlain(p.build_year, locale)],
            [f.direction, pick("directions", p.direction)],
            [f.corner, p.is_corner ? d.yes : null],
          ]}
        />

        <Section title={d.sections.features} rows={[[f.amenities, amenities]]} />

        <Section
          title={d.sections.document}
          rows={[
            [f.documentType, pick("document_types", p.document_type)],
            [f.documentNote, p.document_note],
            [f.ownershipDang, d.dang.replace("{n}", formatNumber(p.ownership_dang, locale, 0))],
            [f.divided, yesNo(p.is_divided)],
            [f.deedScope, pick("deed_scopes", p.deed_scope)],
            [f.ownershipKind, pick("ownership_kinds", p.ownership_kind)],
            [f.occupancy, pick("occupancy", p.occupancy)],
            [f.vacateDate, formatDate(p.vacate_date, locale)],
          ]}
        />

        {hasOwnerInfo ? (
          <Section
            title={d.sections.owner}
            rows={[
              [f.ownerName, p.owner_name],
              [
                f.ownerPhone,
                p.owner_phone ? (
                  tel ? (
                    <a href={tel} dir="ltr" className="files-link">{p.owner_phone}</a>
                  ) : (
                    <bdi dir="ltr">{p.owner_phone}</bdi>
                  )
                ) : null,
              ],
            ]}
          />
        ) : (
          <section className="card detail-section">
            <h2>{d.sections.owner}</h2>
            <p className="files-muted">{d.ownerUnavailable}</p>
          </section>
        )}

        <Section
          title={d.sections.price}
          rows={[...priceRows, [f.priceNote, p.price_note], [f.paymentTerms, p.payment_terms]]}
        />

        <Section
          title={d.sections.dates}
          rows={[
            [f.contractEnd, formatDate(p.contract_end_date, locale)],
            [f.deliveryDate, formatDate(p.delivery_date, locale)],
            [f.reviewDue, formatDate(p.review_due_at, locale)],
            [f.lastConfirmed, formatDateTime(p.last_confirmed_at, locale)],
            [f.created, formatDateTime(p.created_at, locale)],
            [f.updated, formatDateTime(p.updated_at, locale)],
          ]}
        />

        {p.notes ? (
          <section className="card detail-section">
            <h2>{d.sections.notes}</h2>
            <p className="detail-notes">{p.notes}</p>
          </section>
        ) : null}
      </div>
    </>
  );
}
