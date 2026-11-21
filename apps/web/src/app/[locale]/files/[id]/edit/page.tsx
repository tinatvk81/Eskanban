import "@/styles/files.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { PropertyForm } from "@/components/PropertyForm";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { apiFetch } from "@/lib/api";
import { propertyToFormValues } from "@/lib/propertyForm";
import { isUuid } from "@/lib/propertyDetail";
import type { PropertyDetail, VocabMap } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";

export default async function EditFilePage({
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
        <Topbar locale={locale} t={t} path={`/files/${id}/edit`} />
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      </main>
    );
  }
  if (current.data.user.must_change_password) redirect(`/${locale}/change-password`);

  const token = (await getSessionToken()) ?? undefined;
  const isManager = current.data.user.role === "manager";
  const [prop, vocabResult] = await Promise.all([
    apiFetch<PropertyDetail>(`/api/v1/properties/${id}`, { token }),
    apiFetch<VocabMap>("/api/v1/vocab", { token }),
  ]);

  if (!prop.ok && prop.status === 401) redirect(`/${locale}/login`);
  if (!prop.ok && prop.status === 404) notFound();
  if (!vocabResult.ok && vocabResult.status === 401) redirect(`/${locale}/login`);
  // Someone who cannot edit the file never sees the form; the backend re-checks on save.
  if (prop.ok && !prop.data.can_edit) redirect(`/${locale}/files/${id}`);

  return (
    <main className="container files-page">
      <Topbar locale={locale} t={t} path={`/files/${id}/edit`}>
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <p>
        <Link href={`/${locale}/files/${id}`} className="files-btn">{t.fileDetail.back}</Link>
      </p>

      <h1>{t.fileForm.editTitle}</h1>
      <p className="files-muted">{t.fileForm.editIntro}</p>

      {!prop.ok || !vocabResult.ok ? (
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      ) : (
        // key={version}: after "load newest version" the form is rebuilt from the fresh file.
        <PropertyForm
          key={prop.data.version}
          locale={locale}
          t={t}
          vocab={vocabResult.data}
          isManager={isManager}
          advisors={[]}
          edit={{
            id: prop.data.id,
            version: prop.data.version,
            values: propertyToFormValues(prop.data),
            convertibleOptions: prop.data.convertible_options,
            city: prop.data.city,
          }}
        />
      )}
    </main>
  );
}
