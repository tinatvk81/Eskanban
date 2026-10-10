import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/types";

type Props = {
  locale: Locale;
  t: Messages;
  /** Path after the locale, e.g. "/login", so the language switch stays on the same page. */
  path?: string;
  children?: React.ReactNode;
};

export function Topbar({ locale, t, path = "", children }: Props) {
  const other: Locale = locale === "fa" ? "en" : "fa";
  return (
    <header className="topbar">
      <Link href={`/${locale}`} className="brand">
        {t.brand}
      </Link>
      <div className="actions">
        {children}
        <ThemeToggle label={t.theme.toggle} lightLabel={t.theme.light} darkLabel={t.theme.dark} />
        <Link className="btn" href={`/${other}${path}`} hrefLang={other}>
          {t.language.switchTo}
        </Link>
      </div>
    </header>
  );
}
