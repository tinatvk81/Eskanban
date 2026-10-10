import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  const current = await getCurrentUser();
  if (current.status === "unauthenticated") redirect(`/${locale}/login`);
  if (current.status === "unavailable") {
    return (
      <main className="container">
        <Topbar locale={locale} t={t} path="/dashboard" />
        <p className="alert" role="alert">
          {t.errors.unavailable}
        </p>
      </main>
    );
  }

  const { user, agency } = current.data;
  if (user.must_change_password) redirect(`/${locale}/change-password`);

  return (
    <main className="container">
      <Topbar locale={locale} t={t} path="/dashboard">
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <section className="hero">
        <h1>
          {t.dashboard.welcome}، {user.full_name}
        </h1>
      </section>

      <section className="card">
        <h2>{agency.name}</h2>
        <div className="status-row">
          <span>{t.dashboard.role}</span>
          <strong>{t.dashboard.roles[user.role]}</strong>
        </div>
        <div className="status-row">
          <span>{t.dashboard.plan}</span>
          <strong>{t.dashboard.plans[agency.plan]}</strong>
        </div>
        <div className="status-row">
          <span>{t.dashboard.seats}</span>
          <strong>{agency.seat_limit}</strong>
        </div>
      </section>

      <p className="phase">{t.dashboard.comingSoon}</p>
    </main>
  );
}
