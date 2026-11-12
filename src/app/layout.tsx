import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "TAS-One", description: "Timtom Aviation School management platform" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap" />
  </head><body>{children}</body></html>);
}
