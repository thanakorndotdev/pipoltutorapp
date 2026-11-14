import { NotificationPopups } from "@/components/notification-popups";
import type { Metadata } from "next";
import { Anuphan, Mitr } from "next/font/google";
import "./globals.css";

import { SiteAssetsProvider } from "@/components/site-assets";
import { fetchSiteAssets, fetchSiteTexts, SITE_ORIGIN } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const mitr = Mitr({
  variable: "--font-mitr",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

/**
 * Favicon follows the admin "favicon" slot, falling back to public/favicon.ico.
 * The icon lives in public/ (not app/) on purpose: the app/ file convention
 * would emit a second <link rel="icon"> that competes with the uploaded one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const assets = await fetchSiteAssets();
  const icon = assets.favicon?.imageUrl ?? "/favicon.ico";
  const title = "pipoltutor · ติวเข้า ม.1 จภ.";
  const description =
    "คอร์สติวเตรียมสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย";
  // Link previews (LINE, Facebook) need an absolute image; pages with their own
  // openGraph (articles) override this.
  const share = assets.og_image ?? assets.hero_portrait ?? assets.logo;
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title,
    description,
    icons: { icon, apple: icon },
    openGraph: {
      type: "website",
      siteName: "pipoltutor",
      locale: "th_TH",
      title,
      description,
      ...(share ? { images: [{ url: share.imageUrl, alt: share.alt || title }] } : {}),
    },
    twitter: { card: share ? "summary_large_image" : "summary" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [assets, texts, user] = await Promise.all([fetchSiteAssets(), fetchSiteTexts(), getSessionUser()]);
  return (
    <html
      lang="th"
      className={`${mitr.variable} ${anuphan.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved light/dark choice before paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Icon font; Mitr/Anuphan come through next/font above. display=block on
            purpose: with swap the ligature names ("menu") flash as text. */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteAssetsProvider assets={assets} texts={texts} user={user}>
          {children}
          {user?<NotificationPopups/>:null}
        </SiteAssetsProvider>
      </body>
    </html>
  );
}
