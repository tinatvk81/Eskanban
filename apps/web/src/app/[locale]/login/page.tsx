import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Topbar } from "@/components/Topbar";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  // Already signed in? Skip the form. If the backend is down we still show the form.
  const current = await getCurrentUser();
  if (current.status === "ok") {
    redirect(`/${locale}/${current.data.user.must_change_password ? "change-password" : "dashboard"}`);
  }

  return (
    <main className="container">
      <Topbar locale={locale} t={t} path="/login" />
      <LoginForm locale={locale} t={t} />
    </main>
  );
}
