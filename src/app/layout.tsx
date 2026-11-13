import "./globals.css";
import type { Metadata } from "next";
import { ClientRoot } from "@/lib/i18n/ClientRoot";

const csp = "Timtom Aviation School";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://timtomaviationshool.vercel.app"), title: csp, description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda. Browse programmes and apply online.",
  openGraph: { type: "website", siteName: csp, title: csp, description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda. Apply online at any time.", images: ["/images/site/hero-a.jpg"] },
  twitter: { card: "summary_large_image", title: csp, description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda.", images: ["/images/site/hero-a.jpg"] } };
const BOOT = "try{var d=document.documentElement,t=localStorage.getItem('tas_theme');if(t==='dark'||t==='light')d.dataset.theme=t;var m=document.cookie.match(/(?:^|; )tas_lang=([^;]*)/),l=m?m[1]:(navigator.language||'en').slice(0,2).toLowerCase();if(l==='fr'||l==='rw'||l==='sw'){d.lang=l;d.classList.add('i18n-pending')}}catch(e){}";
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en" suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{ __html: BOOT }} />
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap" />
  </head><body><ClientRoot>{children}</ClientRoot></body></html>);
}
