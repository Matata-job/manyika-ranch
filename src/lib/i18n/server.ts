import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, t, type Locale } from "@/lib/i18n/translations";

export async function getRequestLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function serverT() {
  const locale = await getRequestLocale();
  return {
    locale,
    t: (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) =>
      t(locale, key, vars),
  };
}
