import "./globals.css";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { dictFor } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { AutoTranslate } from "@/lib/i18n/AutoTranslate";

const csp = "Timtom Aviation School";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://timtomaviationshool.vercel.app"), title: csp, description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda. Browse programmes and apply online.",
  openGraph: { type: "website", siteName: csp, title: csp, description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda. Apply online at any time.", images: ["/images/site/hero-a.jpg"] },
  twitter: { card: "summary_large_image", title: csp, description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda.", images: ["/images/site/hero-a.jpg"] } };
const THEME = "try{var t=localStorage.getItem('tas_theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}";
export default async function Root({ children }: { children: React.ReactNode }) {
  const { lang } = await getT();
  return (<html lang={lang} suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{ __html: THEME }} />
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap" />
  </head><body><I18nProvider lang={lang} dict={dictFor(lang)}><AutoTranslate />{children}</I18nProvider></body></html>);
}
