import "@/styles/files.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FilesFilterForm } from "@/components/FilesFilterForm";
import { FilesTable } from "@/components/FilesTable";
import { LogoutButton } from "@/components/LogoutButton";
import { Pagination } from "@/components/Pagination";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { apiFetch } from "@/lib/api";
import { errorText } from "@/lib/errorText";
import { formatNumber } from "@/lib/format";
import { buildApiQuery, filesHref, parseFilters } from "@/lib/propertyQuery";
import type { PropertyList, VocabMap } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";

type SearchParams = Record<string, string | string[] | undefined>;
type CityOption = {
  id: number;
  name: string;
  province_id: number;
  province_name: string;
};
export default async function FilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  const current = await getCurrentUser();
  if (current.status === "unauthenticated") redirect(`/${locale}/login`);
  if (current.status === "unavailable") {
    return (
      <main className="container">
        <Topbar locale={locale} t={t} path="/files" />
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      </main>
    );
  }
  if (current.data.user.must_change_password) redirect(`/${locale}/change-password`);

  const token = (await getSessionToken()) ?? undefined;
  const filters = parseFilters(await searchParams);

  const [list, vocabResult, cityResult] = await Promise.all([
  apiFetch<PropertyList>(
    `/api/v1/properties?${buildApiQuery(filters)}`,
    { token },
  ),

  apiFetch<VocabMap>("/api/v1/vocab", { token }),

  filters.city
    ? apiFetch<CityOption>(
        `/api/v1/geo/cities/${filters.city}`,
        { token },
      )
    : Promise.resolve(null),
]);

const vocab: VocabMap = vocabResult.ok ? vocabResult.data : {};

const initialCity =
  cityResult?.ok
    ? cityResult.data
    : null;


  if (!list.ok && list.status === 401) redirect(`/${locale}/login`);

  // A page number past the end (an old link, or filters that shrank the list) shows the last page.
  if (list.ok && list.data.items.length === 0 && filters.page > list.data.total_pages && list.data.total_pages > 0) {
    redirect(filesHref(locale, filters, list.data.total_pages));
  }

  return (
    <main className="container files-page">
      <Topbar locale={locale} t={t} path="/files">
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <div className="files-head">
        <h1>{t.files.title}</h1>
        <Link href={`/${locale}/files/new`} className="files-btn files-btn--primary">
          {t.fileForm.newFile}
        </Link>
      </div>
      <FilesFilterForm
        locale={locale}
        t={t}
        filters={filters}
        vocab={vocab}
        initialCity={initialCity}
      />
      {!list.ok ? (
        <p className="alert" role="alert">
          {list.status === 503 ? t.errors.unavailable : errorText(t, list.error.code, list.retryAfter)}
        </p>
      ) : (
        <>
          <p className="files-count" aria-live="polite">
            {t.files.results.replace("{count}", formatNumber(list.data.total, locale, 0))}
          </p>
          {list.data.items.length === 0 ? (
            <section className="card">
              <h2>{t.files.emptyTitle}</h2>
              <p>{t.files.emptyHint}</p>
            </section>
          ) : (
            <FilesTable rows={list.data.items} vocab={vocab} locale={locale} t={t} />
          )}
          <Pagination
            locale={locale}
            t={t}
            filters={filters}
            page={list.data.page}
            totalPages={list.data.total_pages}
          />
        </>
      )}
    </main>
  );
}