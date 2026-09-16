import type { Metadata } from "next";
import { Anuphan, Mitr } from "next/font/google";
import "./globals.css";

import { Shell } from "@/components/shell";
import { AdminProvider } from "@/lib/admin";

const mitr = Mitr({ variable: "--font-mitr", subsets: ["thai", "latin"], weight: ["400", "500", "600"] });
const anuphan = Anuphan({ variable: "--font-anuphan", subsets: ["thai", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "แผงผู้ดูแลระบบ · PIPOL TUTOR",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${mitr.variable} ${anuphan.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block"
        />
      </head>
      <body className="min-h-full">
        <AdminProvider>
          <Shell>{children}</Shell>
        </AdminProvider>
      </body>
    </html>
  );
}
