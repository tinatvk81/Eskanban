import Form from "next/form";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";
import { SORTS, STATUSES, type FileFilters } from "@/lib/propertyQuery";
import type { VocabMap } from "@/lib/propertyTypes";

type Props = { locale: Locale; t: Messages; filters: FileFilters; vocab: VocabMap };

const SORT_LABEL: Record<(typeof SORTS)[number], keyof Messages["files"]["sortOptions"]> = {
  "created_at:desc": "newest",
  "updated_at:desc": "recentlyUpdated",
  "price:asc": "priceLow",
  "price:desc": "priceHigh",
  "area:desc": "areaLarge",
  "area:asc": "areaSmall",
  "contract_end_date:asc": "contractEnding",
};

function NumberField(props: { name: string; label: string; value: string }) {
  return (
    <label className="files-field">
      <span>{props.label}</span>
      <input type="text" inputMode="numeric" name={props.name} defaultValue={props.value} autoComplete="off" />
    </label>
  );
}

export function FilesFilterForm({ locale, t, filters, vocab }: Props) {
  const f = t.files;
  const hasAdvanced = Boolean(
    filters.pmin || filters.pmax || filters.amin || filters.amax ||
      filters.rmin || filters.rmax || filters.urgent || filters.fav,
  );

  return (
    <Form action={`/${locale}/files`} className="files-filter" role="search">
      <div className="files-grid">
        <label className="files-field files-field--wide">
          <span>{f.search}</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder={f.searchPlaceholder}
            maxLength={100}
            autoComplete="off"
          />
        </label>

        <label className="files-field">
          <span>{f.dealType}</span>
          <select name="deal" defaultValue={filters.deal}>
            <option value="">{f.all}</option>
            {(vocab.deal_types ?? []).map((i) => (
              <option key={i.key} value={i.key}>{i[locale]}</option>
            ))}
          </select>
        </label>

        <label className="files-field">
          <span>{f.propertyType}</span>
          <select name="type" defaultValue={filters.type}>
            <option value="">{f.all}</option>
            {(vocab.property_types ?? []).map((i) => (
              <option key={i.key} value={i.key}>{i[locale]}</option>
            ))}
          </select>
        </label>

        <label className="files-field">
          <span>{f.status}</span>
          <select name="status" defaultValue={filters.status}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{f.statusOptions[s]}</option>
            ))}
          </select>
        </label>

        <label className="files-field">
          <span>{f.sort}</span>
          <select name="sort" defaultValue={filters.sort}>
            {SORTS.map((s) => (
              <option key={s} value={s}>{f.sortOptions[SORT_LABEL[s]]}</option>
            ))}
          </select>
        </label>
      </div>

      <details className="files-more" open={hasAdvanced}>
        <summary>{f.moreFilters}</summary>
        <div className="files-grid">
          <NumberField name="pmin" label={f.priceMin} value={filters.pmin} />
          <NumberField name="pmax" label={f.priceMax} value={filters.pmax} />
          <NumberField name="amin" label={f.areaMin} value={filters.amin} />
          <NumberField name="amax" label={f.areaMax} value={filters.amax} />
          <NumberField name="rmin" label={f.roomsMin} value={filters.rmin} />
          <NumberField name="rmax" label={f.roomsMax} value={filters.rmax} />
          <label className="files-check">
            <input type="checkbox" name="urgent" value="1" defaultChecked={filters.urgent} />
            <span>{f.urgentOnly}</span>
          </label>
          <label className="files-check">
            <input type="checkbox" name="fav" value="1" defaultChecked={filters.fav} />
            <span>{f.favoritesOnly}</span>
          </label>
        </div>
      </details>

      <div className="files-actions">
        <button type="submit" className="files-btn files-btn--primary">{f.apply}</button>
        <Link href={`/${locale}/files`} className="files-btn">{f.reset}</Link>
      </div>
    </Form>
  );
}