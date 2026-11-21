import "@/styles/files.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { PropertyForm } from "@/components/PropertyForm";
import type { AdvisorOption } from "@/components/PropertyActions";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { apiFetch } from "@/lib/api";
import type { VocabMap } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";
import type { ApiUser } from "@/lib/types";

export default async function NewFilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  const current = await getCurrentUser();
  if (current.status === "unauthenticated") redirect(`/${locale}/login`);
  if (current.status === "unavailable") {
    return (
      <main className="container">
        <Topbar locale={locale} t={t} path="/files/new" />
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      </main>
    );
  }
  if (current.data.user.must_change_password) redirect(`/${locale}/change-password`);

  const token = (await getSessionToken()) ?? undefined;
  const isManager = current.data.user.role === "manager";
  const [vocabResult, usersResult] = await Promise.all([
    apiFetch<VocabMap>("/api/v1/vocab", { token }),
    isManager ? apiFetch<ApiUser[]>("/api/v1/users", { token }) : Promise.resolve(null),
  ]);

  if (!vocabResult.ok && vocabResult.status === 401) redirect(`/${locale}/login`);

  const advisors: AdvisorOption[] =
    usersResult && usersResult.ok
      ? usersResult.data
          .filter((u) => u.is_active)
          .map((u) => ({ id: u.id, full_name: u.full_name }))
      : [];

  return (
    <main className="container files-page">
      <Topbar locale={locale} t={t} path="/files/new">
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <p>
        <Link href={`/${locale}/files`} className="files-btn">{t.fileDetail.back}</Link>
      </p>

      <h1>{t.fileForm.title}</h1>
      <p className="files-muted">{t.fileForm.intro}</p>

      {!vocabResult.ok ? (
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      ) : (
        <PropertyForm
          locale={locale}
          t={t}
          vocab={vocabResult.data}
          isManager={isManager}
          advisors={advisors}
        />
      )}
    </main>
  );
}
