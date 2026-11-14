import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Band } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { DailyClient } from "./daily-client";
export const metadata = { title: "โจทย์ประจำวัน · pipoltutor" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [user, query] = await Promise.all([getSessionUser(), searchParams]);
  return (
    <>
      <SiteHeader current="daily" />
      <main className="flex-1">
        <Band className="py-10">
          <DailyClient date={query.date} loggedIn={!!user} />
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
