import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiStatus } from "@/components/ApiStatus";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  return (
    <main className="container">
      <Topbar locale={locale} t={t} />

      <section className="hero">
        <h1>{t.brand}</h1>
        <p>{t.tagline}</p>
        <Link className="btn btn-primary" href={`/${locale}/login`}>
          {t.auth.signIn}
        </Link>
      </section>

      <ApiStatus
        title={t.status.title}
        webLabel={t.status.web}
        apiLabel={t.status.api}
        okLabel={t.status.ok}
        downLabel={t.status.down}
        checkingLabel={t.status.checking}
      />

      <p className="phase">{t.phase}</p>
    </main>
  );
}
