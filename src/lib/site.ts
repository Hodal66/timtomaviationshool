/** One place for school-wide facts. Contact details come from the School's existing public website; socials and WhatsApp are configured, never invented. */
const env = (k: string) => (process.env[k] ?? "").trim() || null;

export const SITE = {
  name: "Timtom Aviation School",
  url: env("NEXT_PUBLIC_SITE_URL") ?? "https://timtomaviationshool.vercel.app",
  phone: "+250788519634",
  phoneDisplay: "(+250) 788 519 634",
  email: env("NEXT_PUBLIC_CONTACT_EMAIL") ?? "info@timtomaviation.com",
  address: "Kabeza road, KK 18 AV",
  mission: "To become an African hub in providing knowledge and consultancy service in the field of aviation, hospitality, tourism, and ICT.",
  about: "TIMTOM AVIATION is a private company which offers consultancy services in the field of management and also offers training in the field of aviation management, hospitality, tourism and ICT.",
  branches: ["Kigali", "Bugesera–Nyamata", "Goma"],
  whatsapp: (env("NEXT_PUBLIC_WHATSAPP_NUMBER") ?? "+250788519634").replace(/\D/g, ""),
  socials: ([
    ["Facebook", env("NEXT_PUBLIC_FACEBOOK_URL")], ["Instagram", env("NEXT_PUBLIC_INSTAGRAM_URL")], ["LinkedIn", env("NEXT_PUBLIC_LINKEDIN_URL")],
    ["X", env("NEXT_PUBLIC_X_URL")], ["YouTube", env("NEXT_PUBLIC_YOUTUBE_URL")],
  ] as [string, string | null][]).filter((s): s is [string, string] => !!s[1]),
};

export const NAV = [
  { href: "/", label: "Home" }, { href: "/about", label: "About" }, { href: "/courses", label: "Courses" },
  { href: "/how-to-apply", label: "Admissions" }, { href: "/contact", label: "Contact" },
];
