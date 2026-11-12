import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import { listMedia, cloudinaryReady } from "@/lib/cloudinary";
export const revalidate = 60;
export const metadata: Metadata = { title: "Gallery | Timtom Aviation School", description: "Photos, videos, audio and documents from Timtom Aviation School: campus life, training and events.", alternates: { canonical: "/gallery" } };
export default async function GalleryPage() {
  const items = cloudinaryReady() ? await listMedia() : [];
  return (<section className="sx"><div className="wrap">
    <span className="eyebrow">Gallery</span><h1 style={{ margin: "14px 0 24px" }}>Life at Timtom Aviation School</h1>
    {items.length ? <Gallery items={items} /> : <p className="lead">Our gallery is being prepared. Please check back soon.</p>}
  </div></section>);
}
