/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 31536000 },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};
