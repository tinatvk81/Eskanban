"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import type { AdvisorOption } from "@/components/PropertyActions";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { errorText } from "@/lib/errorText";
import {
  buildCreatePayload,
  EMPTY_FORM,
  type FormErrors,
  type FormValues,
} from "@/lib/propertyForm";
import type { VocabItem, VocabMap } from "@/lib/propertyTypes";

type Props = {
  locale: Locale;
  t: Messages;
  vocab: VocabMap;
  isManager: boolean;
  advisors: AdvisorOption[];
};

type Key = keyof FormValues;
type StrKey = { [K in Key]: FormValues[K] extends string ? K : never }[Key];
type ListKey = "property_types" | "amenities";
type FlagKey = "is_corner" | "is_urgent";
type InputOptions = { numeric?: boolean; ltr?: boolean; max?: number; type?: "text" | "date" };

const SALE_LIKE = ["sale", "presale"];
const RENT_LIKE = ["rent", "mortgage"];

// Which fields live in which collapsible section, so a section with an error opens by itself.
const LOCATION: Key[] = ["address", "location_url"];
const SPACE: Key[] = [
  "land_area_m2",
  "built_area_m2",
  "rooms",
  "floor",
  "total_floors",
  "total_units",
  "build_year",
  "direction",
];
const FEATURES: Key[] = ["amenities", "custom_amenities"];
const DOCUMENT: Key[] = [
  "document_type",
  "document_note",
  "ownership_dang",
  "is_divided",
  "deed_scope",
  "ownership_kind",
  "occupancy",
  "vacate_date",
];
const OWNER: Key[] = ["owner_name", "owner_phone"];
const DATES: Key[] = [
  "contract_end_date",
  "delivery_date",
  "urgent_until",
  "price_note",
  "payment_terms",
];
const NOTES: Key[] = ["notes"];

// The backend drops fields that do not belong to the deal type anyway. Clearing them here means
// a stale value typed under another deal type can never block a submit with an invisible error.
function pruneByDeal(v: FormValues): FormValues {
  const deal = v.deal_type;
  const out = { ...v };
  if (!SALE_LIKE.includes(deal)) {
    out.price_total = "";
    out.price_per_m2 = "";
  }
  if (!RENT_LIKE.includes(deal)) {
    out.deposit = "";
    out.contract_end_date = "";
  }
  if (deal !== "rent") out.monthly_rent = "";
  if (deal !== "presale") {
    out.delivery_date = "";
    out.payment_terms = "";
  }
  return out;
}

function Section({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  return (
    <details className="files-more" open={open ? true : undefined}>
      <summary>{title}</summary>
      <div className="files-grid">{children}</div>
    </details>
  );
}

export function PropertyForm({ locale, t, vocab, isManager, advisors }: Props) {
  const f = t.fileForm;
  const d = t.fileDetail.fields;
  const s = t.fileDetail.sections;
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends Key>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggle(name: ListKey, key: string) {
    setValues((current) => ({
      ...current,
      [name]: current[name].includes(key)
        ? current[name].filter((item) => item !== key)
        : [...current[name], key],
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    // The city picker keeps its id in a hidden field named "city" and the district in "district".
    const data = new FormData(event.currentTarget);
    const built = buildCreatePayload({
      ...pruneByDeal(values),
      city_id: String(data.get("city") ?? ""),
      district: String(data.get("district") ?? ""),
    });
    if (!built.ok) {
      setErrors(built.errors);
      setMessage(null);
      return;
    }

    setErrors({});
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.body),
      });
      if (res.ok) {
        const created = (await res.json().catch(() => null)) as { id?: string } | null;
        router.replace(created?.id ? `/${locale}/files/${created.id}` : `/${locale}/files`);
        router.refresh();
        return; // stay busy while navigating so the file cannot be created twice
      }
      if (res.status === 401) {
        router.replace(`/${locale}/login`);
        return;
      }
      let code: string | undefined;
      try {
        code = ((await res.json()) as { error?: { code?: string } })?.error?.code;
      } catch {
        /* non-JSON error body */
      }
      setMessage(res.status === 422 ? f.invalidInput : errorText(t, code));
    } catch {
      setMessage(t.errors.unavailable);
    }
    setBusy(false);
  }

  const err = (key: Key): string | null => {
    const e = errors[key];
    return e ? f.fieldErrors[e] : null;
  };
  const sectionHasError = (keys: Key[]) => keys.some((k) => errors[k] !== undefined);
  const hasErrors = Object.keys(errors).length > 0;
  const labelOf: Record<string, string> = {
    deal_type: d.dealType,
    city_id: t.files.city,
    price_total: d.price,
    price_per_m2: d.pricePerM2,
    deposit: d.deposit,
    monthly_rent: d.monthlyRent,
    address: d.address,
    location_url: d.locationLink,
    land_area_m2: d.landArea,
    built_area_m2: d.builtArea,
    rooms: d.rooms,
    floor: d.floor,
    total_floors: d.totalFloors,
    total_units: d.totalUnits,
    build_year: d.buildYear,
    ownership_dang: d.ownershipDang,
    vacate_date: d.vacateDate,
    contract_end_date: d.contractEnd,
    delivery_date: d.deliveryDate,
    urgent_until: d.urgentUntil,
    owner_name: d.ownerName,
    owner_phone: d.ownerPhone,
  };
  const failing = Object.keys(errors)
    .map((k) => labelOf[k] ?? k)
    .join(locale === "fa" ? "، " : ", ");

  const cell = (name: Key, label: string, control: ReactNode, wide = false, hint?: string) => (
    <div className={`files-field form-cell${wide ? " files-field--wide" : ""}`}>
      <label htmlFor={`pf-${name}`}>{label}</label>
      {control}
      {hint ? <small className="files-field-hint">{hint}</small> : null}
      {err(name) ? (
        <p className="alert" role="alert">
          {err(name)}
        </p>
      ) : null}
    </div>
  );

  const input = (name: StrKey, label: string, o: InputOptions = {}) =>
    cell(
      name,
      label,
      <input
        id={`pf-${name}`}
        type={o.type ?? "text"}
        inputMode={o.numeric ? "numeric" : undefined}
        dir={o.ltr ? "ltr" : undefined}
        maxLength={o.max}
        autoComplete="off"
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
      />,
    );

  const area = (name: StrKey, label: string, max: number, hint?: string) =>
    cell(
      name,
      label,
      <textarea
        id={`pf-${name}`}
        rows={3}
        maxLength={max}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
      />,
      true,
      hint,
    );

  const select = (
    name: StrKey,
    label: string,
    options: Array<[string, string]>,
    placeholder: string,
  ) =>
    cell(
      name,
      label,
      <select id={`pf-${name}`} value={values[name]} onChange={(e) => set(name, e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>,
    );

  const vocabOptions = (key: string): Array<[string, string]> =>
    (vocab[key] ?? []).map((item: VocabItem) => [item.key, item[locale]]);

  const checkGroup = (name: ListKey, legend: string) => (
    <fieldset className="form-group files-field--wide">
      <legend>{legend}</legend>
      <div className="files-grid">
        {(vocab[name] ?? []).map((item: VocabItem) => (
          <label key={item.key} className="files-check">
            <input
              type="checkbox"
              checked={values[name].includes(item.key)}
              onChange={() => toggle(name, item.key)}
            />
            {item[locale]}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const flag = (name: FlagKey, label: string) => (
    <label className="files-check">
      <input
        type="checkbox"
        checked={values[name]}
        onChange={(e) => set(name, e.target.checked)}
      />
      {label}
    </label>
  );

  const saleLike = SALE_LIKE.includes(values.deal_type);
  const rentLike = RENT_LIKE.includes(values.deal_type);
  const presale = values.deal_type === "presale";

  return (
    <form className="files-filter" onSubmit={onSubmit} noValidate>
      <div className="files-grid">
        {select("deal_type", d.dealType, vocabOptions("deal_types"), f.choose)}
        {isManager && advisors.length > 0
          ? select(
              "owner_user_id",
              f.assignTo,
              advisors.map((a): [string, string] => [a.id, a.full_name]),
              f.assignSelf,
            )
          : null}
        {checkGroup("property_types", t.files.propertyType)}
        <CityAutocomplete
          initialCity={null}
          initialDistrict=""
          labels={{
            city: t.files.city,
            district: t.files.district,
            cityPlaceholder: t.files.cityPlaceholder,
            districtPlaceholder: t.files.districtPlaceholder,
            citySearching: t.files.citySearching,
            cityNoResults: t.files.cityNoResults,
            districtHint: t.files.districtHint,
          }}
        />
        {errors.city_id ? (
          <p className="alert files-field--wide" role="alert">
            {f.fieldErrors[errors.city_id]}
          </p>
        ) : null}
        {saleLike ? (
          <>
            {input("price_total", d.price, { numeric: true, ltr: true })}
            {input("price_per_m2", d.pricePerM2, { numeric: true, ltr: true })}
          </>
        ) : null}
        {rentLike ? (
          <>
            {input("deposit", d.deposit, { numeric: true, ltr: true })}
            {values.deal_type === "rent"
              ? input("monthly_rent", d.monthlyRent, { numeric: true, ltr: true })
              : null}
          </>
        ) : null}
      </div>

      <Section title={s.location} open={sectionHasError(LOCATION)}>
        {input("address", d.address, { max: 255 })}
        {input("location_url", d.locationLink, { max: 500, ltr: true })}
      </Section>

      <Section title={s.space} open={sectionHasError(SPACE)}>
        {input("land_area_m2", d.landArea, { numeric: true, ltr: true })}
        {input("built_area_m2", d.builtArea, { numeric: true, ltr: true })}
        {input("rooms", d.rooms, { numeric: true, ltr: true })}
        {input("floor", d.floor, { numeric: true, ltr: true })}
        {input("total_floors", d.totalFloors, { numeric: true, ltr: true })}
        {input("total_units", d.totalUnits, { numeric: true, ltr: true })}
        {input("build_year", d.buildYear, { numeric: true, ltr: true })}
        {select("direction", d.direction, vocabOptions("directions"), f.choose)}
        {flag("is_corner", d.corner)}
      </Section>

      <Section title={s.features} open={sectionHasError(FEATURES)}>
        {checkGroup("amenities", d.amenities)}
        {area("custom_amenities", f.customAmenities, 1200, f.customAmenitiesHint)}
      </Section>

      <Section title={s.document} open={sectionHasError(DOCUMENT)}>
        {select("document_type", d.documentType, vocabOptions("document_types"), f.choose)}
        {input("document_note", d.documentNote, { max: 200 })}
        {input("ownership_dang", d.ownershipDang, { numeric: true, ltr: true })}
        {select(
          "is_divided",
          d.divided,
          [
            ["yes", t.fileDetail.yes],
            ["no", t.fileDetail.no],
          ],
          f.unknown,
        )}
        {select("deed_scope", d.deedScope, vocabOptions("deed_scopes"), f.choose)}
        {select("ownership_kind", d.ownershipKind, vocabOptions("ownership_kinds"), f.choose)}
        {select("occupancy", d.occupancy, vocabOptions("occupancy"), f.choose)}
        {input("vacate_date", d.vacateDate, { type: "date", ltr: true })}
      </Section>

      <Section title={s.owner} open={sectionHasError(OWNER)}>
        {input("owner_name", d.ownerName, { max: 120 })}
        {input("owner_phone", d.ownerPhone, { max: 32, ltr: true })}
      </Section>

      <Section title={s.dates} open={sectionHasError(DATES)}>
        {rentLike ? input("contract_end_date", d.contractEnd, { type: "date", ltr: true }) : null}
        {presale ? input("delivery_date", d.deliveryDate, { type: "date", ltr: true }) : null}
        {flag("is_urgent", d.urgent)}
        {values.is_urgent ? input("urgent_until", d.urgentUntil, { type: "date", ltr: true }) : null}
        {area("price_note", d.priceNote, 500)}
        {presale ? area("payment_terms", d.paymentTerms, 1000) : null}
      </Section>

      <Section title={s.notes} open={sectionHasError(NOTES)}>
        {area("notes", s.notes, 2000)}
      </Section>

      {hasErrors ? (
        <p className="alert" role="alert">
          {f.fixErrors} <span>({failing})</span>
        </p>
      ) : null}
      {message ? (
        <p className="alert" role="alert">
          {message}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="files-btn files-btn--primary" disabled={busy}>
          {busy ? f.submitting : f.submit}
        </button>
        <Link href={`/${locale}/files`} className="files-btn">
          {f.cancel}
        </Link>
      </div>
    </form>
  );
}
