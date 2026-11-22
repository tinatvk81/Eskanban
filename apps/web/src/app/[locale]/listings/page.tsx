import { notFound, redirect } from "next/navigation";
import { AddListingLinkForm } from "@/components/AddListingLinkForm";
import { ListingsTable } from "@/components/ListingsTable";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { apiFetch } from "@/lib/api";
import type { ListingPage } from "@/lib/listingTypes";
import type { VocabMap } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";

export default async function ListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  const current = await getCurrentUser();
  if (current.status === "unauthenticated") redirect(`/${locale}/login`);
  if (current.status === "unavailable") {
    return (
      <main className="container">
        <Topbar locale={locale} t={t} path="/listings" />
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      </main>
    );
  }
  if (current.data.user.must_change_password) redirect(`/${locale}/change-password`);

  const token = (await getSessionToken()) ?? undefined;

  const [list, vocabResult] = await Promise.all([
    apiFetch<ListingPage>("/api/v1/listings?status=new&page=1&page_size=20", { token }),
    apiFetch<VocabMap>("/api/v1/vocab", { token }),
  ]);

  if (!list.ok && list.status === 401) redirect(`/${locale}/login`);

  const vocab: VocabMap = vocabResult.ok ? vocabResult.data : {};
  const l = t.listings;

  return (
    <main className="container files-page">
      <Topbar locale={locale} t={t} path="/listings" />
      <h1>{l.title}</h1>

      <AddListingLinkForm t={t} />

      {list.ok ? (
        list.data.items.length > 0 ? (
          <>
            <p className="files-count">{l.count.replace("{n}", String(list.data.total))}</p>
            <ListingsTable rows={list.data.items} vocab={vocab} locale={locale} t={t} />
          </>
        ) : (
          <p className="files-muted">{l.empty}</p>
        )
      ) : (
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      )}
    </main>
  );
}
