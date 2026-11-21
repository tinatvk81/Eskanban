import "@/styles/files.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditLink } from "@/components/EditLink";
import { LogoutButton } from "@/components/LogoutButton";
import { PropertyActions, type AdvisorOption } from "@/components/PropertyActions";
import { PropertyDetail } from "@/components/PropertyDetail";
import { PropertyHistory } from "@/components/PropertyHistory";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { apiFetch } from "@/lib/api";
import { errorText } from "@/lib/errorText";
import { isUuid } from "@/lib/propertyDetail";
import type { HistoryEntry, PropertyDetail as Detail, VocabMap } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";
import type { ApiUser } from "@/lib/types";

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  if (!isUuid(id)) notFound();
  const t = getMessages(locale);

  const current = await getCurrentUser();
  if (current.status === "unauthenticated") redirect(`/${locale}/login`);
  if (current.status === "unavailable") {
    return (
      <main className="container">
        <Topbar locale={locale} t={t} path={`/files/${id}`} />
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      </main>
    );
  }
  if (current.data.user.must_change_password) redirect(`/${locale}/change-password`);

  const token = (await getSessionToken()) ?? undefined;
  const isManager = current.data.user.role === "manager";
  const [prop, history, vocabResult, usersResult] = await Promise.all([
    apiFetch<Detail>(`/api/v1/properties/${id}`, { token }),
    apiFetch<HistoryEntry[]>(`/api/v1/properties/${id}/history`, { token }),
    apiFetch<VocabMap>("/api/v1/vocab", { token }),
    isManager ? apiFetch<ApiUser[]>("/api/v1/users", { token }) : Promise.resolve(null),
  ]);

  if (!prop.ok && prop.status === 401) redirect(`/${locale}/login`);
  if (!prop.ok && prop.status === 404) notFound();

  const vocab: VocabMap = vocabResult.ok ? vocabResult.data : {};
  const advisors: AdvisorOption[] =
    usersResult && usersResult.ok
      ? usersResult.data
          .filter((u) => u.is_active)
          .map((u) => ({ id: u.id, full_name: u.full_name }))
      : [];

  return (
    <main className="container files-page">
      <Topbar locale={locale} t={t} path={`/files/${id}`}>
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <p>
        <Link href={`/${locale}/files`} className="files-btn">{t.fileDetail.back}</Link>
      </p>

      {!prop.ok ? (
        <p className="alert" role="alert">
          {prop.status === 503 ? t.errors.unavailable : errorText(t, prop.error.code, prop.retryAfter)}
        </p>
      ) : (
        <>
          <EditLink
            locale={locale}
            id={prop.data.id}
            canEdit={prop.data.can_edit}
            label={t.fileForm.editLink}
          />
          <PropertyDetail property={prop.data} vocab={vocab} locale={locale} t={t} />
          <PropertyActions
            locale={locale}
            t={t}
            propertyId={prop.data.id}
            status={prop.data.status}
            isFavorite={prop.data.is_favorite}
            isShared={prop.data.shared_with_agency}
            ownerId={prop.data.owner.id}
            canEdit={prop.data.can_edit}
            isManager={isManager}
            statuses={vocab.statuses ?? []}
            advisors={advisors}
          />
          <PropertyHistory entries={history.ok ? history.data : null} locale={locale} t={t} />
        </>
      )}
    </main>
  );
}
