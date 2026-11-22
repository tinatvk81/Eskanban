import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { apiFetch } from "@/lib/api";
import { errorText } from "@/lib/errorText";
import type { PropertyStats } from "@/lib/propertyTypes";
import { getCurrentUser, getSessionToken } from "@/lib/session";

export default async function DashboardPage({
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
        <Topbar locale={locale} t={t} path="/dashboard" />
        <p className="alert" role="alert">{t.errors.unavailable}</p>
      </main>
    );
  }

  const { user, agency } = current.data;
  if (user.must_change_password) redirect(`/${locale}/change-password`);

  const token = (await getSessionToken()) ?? undefined;
  const statsResult = await apiFetch<PropertyStats>(
    "/api/v1/properties/stats",
    { token },
  );

  if (!statsResult.ok && statsResult.status === 401) {
    redirect(`/${locale}/login`);
  }

  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(value);

  const statsData = statsResult.ok ? statsResult.data : null;

  const summaryCards = statsData
    ? [
        { key: "total", label: t.dashboard.totalActive, value: statsData.total_active },
        { key: "new", label: t.dashboard.newThisWeek, value: statsData.new_this_week },
        { key: "urgent", label: t.dashboard.urgent, value: statsData.urgent },
        { key: "overdue", label: t.dashboard.contractsOverdue, value: statsData.contracts_overdue },
        { key: "ending7", label: t.dashboard.contractsEnding7Days, value: statsData.contracts_ending_7_days },
        { key: "ending30", label: t.dashboard.contractsEnding30Days, value: statsData.contracts_ending_30_days },
      ]
    : [];

  const dealCards = statsData
    ? [
        { key: "sale", label: t.dashboard.deals.sale, value: statsData.by_deal_type.sale },
        { key: "presale", label: t.dashboard.deals.presale, value: statsData.by_deal_type.presale },
        { key: "rent", label: t.dashboard.deals.rent, value: statsData.by_deal_type.rent },
        { key: "mortgage", label: t.dashboard.deals.mortgage, value: statsData.by_deal_type.mortgage },
      ]
    : [];

  const statsError = !statsResult.ok
    ? statsResult.status === 503
      ? t.errors.unavailable
      : errorText(t, statsResult.error.code, statsResult.retryAfter)
    : null;

  return (
    <main className="container dashboard-page">
      <Topbar locale={locale} t={t} path="/dashboard">
        <LogoutButton locale={locale} label={t.auth.logout} />
      </Topbar>

      <section className="hero">
        <h1>
          {t.dashboard.welcome}، {user.full_name}
        </h1>
      </section>

      <section className="card dashboard-agency">
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
          <strong>{formatCount(agency.seat_limit)}</strong>
        </div>
      </section>

      <section className="dashboard-stats" aria-labelledby="dashboard-stats-title">
        <h2 id="dashboard-stats-title">{t.dashboard.statsTitle}</h2>

        {statsError ? (
          <p className="alert" role="alert">{statsError}</p>
        ) : (
          <>
            <div className="dashboard-stats-grid">
              {summaryCards.map((item) => (
                <article className="card dashboard-stat-card" key={item.key}>
                  <h3>{item.label}</h3>
                  <p className="dashboard-stat-value" dir="auto">
                    {formatCount(item.value)}
                  </p>
                </article>
              ))}
            </div>

            <section className="card dashboard-deals">
              <h3>{t.dashboard.dealBreakdown}</h3>
              <div className="dashboard-deals-grid">
                {dealCards.map((item) => (
                  <div className="dashboard-deal-item" key={item.key}>
                    <span>{item.label}</span>
                    <strong>{formatCount(item.value)}</strong>
                  </div>
                ))}
              </div>
            </section>

            {statsData?.total_active === 0 ? (
              <p className="dashboard-empty">{t.dashboard.noActiveProperties}</p>
            ) : null}
          </>
        )}
      </section>

      <p className="dashboard-files-link">
        <Link href={`/${locale}/files`}>{t.files.title}</Link>
      </p>

      <p className="phase">{t.dashboard.comingSoon}</p>
    </main>
  );
}
