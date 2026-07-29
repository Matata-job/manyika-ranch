import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { SessionProvider } from "@/components/providers/session-provider";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/translations";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Manyika Ranch — Livestock Management",
  description: "Livestock management system for Singida ranch operations",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Manyika Ranch",
  },
};

export const viewport: Viewport = {
  themeColor: "#2d5a3d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(raw) ? raw : "en";

  return (
    <html lang={locale === "sw" ? "sw" : "en"}>
      <body className={inter.className}>
        <SessionProvider>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
