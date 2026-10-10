import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "@fontsource-variable/vazirmatn";
import "@/styles/globals.css";
import { ThemeScript } from "@/components/ThemeScript";
import { isLocale, localeDirection, locales } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";

type Params = { locale: string };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getMessages(locale);
  return {
    title: `${t.brand} — ${t.tagline}`,
    description: t.tagline,
    robots: { index: false, follow: false }, // staging: keep out of search engines
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<Params>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} dir={localeDirection[locale]} data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
