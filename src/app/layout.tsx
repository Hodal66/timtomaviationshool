import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://timtomaviationshool.vercel.app"), title: "Timtom Aviation School", description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda. Browse programmes and apply online.",
  openGraph: { type: "website", siteName: "Timtom Aviation School", title: "Timtom Aviation School", description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda. Apply online at any time.", images: ["/images/site/hero-a.jpg"] },
  twitter: { card: "summary_large_image", title: "Timtom Aviation School", description: "Aviation, airport operations, travel, tourism and ICT training in Rwanda.", images: ["/images/site/hero-a.jpg"] } };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en" suppressHydrationWarning><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap" />
  </head><body>{children}</body></html>);
}
