import type { Metadata } from "next";
import { Anuphan, Mitr } from "next/font/google";
import "./globals.css";

import { SiteAssetsProvider } from "@/components/site-assets";
import { fetchSiteAssets, fetchSiteTexts } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

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
  const favicon = (await fetchSiteAssets()).favicon;
  const icon = favicon?.imageUrl ?? "/favicon.ico";
  return {
    title: "PIPOL TUTOR · ติวเข้า ม.1 จภ.",
    description:
      "คอร์สติวเตรียมสอบเข้า ม.1 โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย",
    icons: { icon, apple: icon },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [assets, texts, user] = await Promise.all([fetchSiteAssets(), fetchSiteTexts(), getSessionUser()]);
  return (
    <html
      lang="th"
      className={`${mitr.variable} ${anuphan.variable} h-full antialiased`}
    >
      <head>
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
        </SiteAssetsProvider>
      </body>
    </html>
  );
}
