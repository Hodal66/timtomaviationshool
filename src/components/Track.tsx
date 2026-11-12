"use client";
import { useEffect } from "react";

function utm() {
  const q = new URLSearchParams(location.search);
  return { utmSource: q.get("utm_source"), utmMedium: q.get("utm_medium"), utmCampaign: q.get("utm_campaign") };
}
export function send(type: string, programmeId?: string | null) {
  try {
    const body = JSON.stringify({ type, path: location.pathname, programmeId: programmeId ?? null, lang: navigator.language, ...utm() });
    navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }));
  } catch { /* ignore */ }
  try { const u = utm(); if (u.utmSource) document.cookie = "tas_utm=" + encodeURIComponent(JSON.stringify(u)) + "; path=/; max-age=2592000; SameSite=Lax; Secure"; } catch { /* ignore */ }
}
export function Track({ programmeId }: { programmeId?: string }) {
  useEffect(() => { send("PAGE_VIEW", programmeId); }, [programmeId]);
  return null;
}
/** Apply Now link. Records the click and carries campaign parameters into the wizard. */
export function ApplyLink({ href, programmeId, className, children }: { href: string; programmeId?: string; className?: string; children: React.ReactNode }) {
  return (<a href={href} className={className} onClick={() => send("APPLY_CLICK", programmeId)}>{children}</a>);
}
