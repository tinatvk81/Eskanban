import "@/styles/files.css";
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
import { buildApiQuery, parseFilters } from "@/lib/propertyQuery";
import type { PropertyList, VocabMap } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";

type SearchParams = Record<string, string | string[] | undefined>;

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

  const [list, vocabResult] = await Promise.all([
    apiFetch<PropertyList>(`/api/v1/properties?${buildApiQuery(filters)}`, { token }),
    apiFetch<VocabMap>("/api/v1/vocab", { token }),
  ]);
  if (!list.ok && list.status === 401) redirect(`/${locale}/login`);
  const vocab: VocabMap = vocabResult.ok ? vocabResult.data : {};

  return (
    <main className="container files-page">
      <Topbar locale={locale} t={t} path="/files">
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <h1>{t.files.title}</h1>
      <FilesFilterForm locale={locale} t={t} filters={filters} vocab={vocab} />

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