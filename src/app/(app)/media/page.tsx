import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { can } from "@/lib/perm";
import { listMedia, cloudinaryReady } from "@/lib/cloudinary";
import { MediaManager } from "@/components/MediaManager";
export const dynamic = "force-dynamic";
export default async function Media() {
  const me = await getSession(); if (!me || !can.editContent(me.role)) redirect("/dashboard");
  const items = cloudinaryReady() ? await listMedia() : [];
  return (<><div className="top"><h1>Media library</h1><p>Photos, videos, audio and documents uploaded here appear on the website gallery within a minute.</p></div>
    {cloudinaryReady() ? <MediaManager initial={items} /> : <div className="panel"><p>Cloudinary is not connected. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the hosting settings.</p></div>}</>);
}
