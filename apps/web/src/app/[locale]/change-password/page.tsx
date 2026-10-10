import { notFound, redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { LogoutButton } from "@/components/LogoutButton";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getCurrentUser } from "@/lib/session";

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  const current = await getCurrentUser();
  if (current.status === "unauthenticated") redirect(`/${locale}/login`);

  return (
    <main className="container">
      <Topbar locale={locale} t={t} path="/change-password">
        {current.status === "ok" && <LogoutButton locale={locale} label={t.auth.logout} />}
      </Topbar>
      {current.status === "unavailable" ? (
        <p className="alert" role="alert">
          {t.errors.unavailable}
        </p>
      ) : (
        <ChangePasswordForm locale={locale} t={t} />
      )}
    </main>
  );
}
