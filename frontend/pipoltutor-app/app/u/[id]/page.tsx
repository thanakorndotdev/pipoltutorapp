import { notFound, redirect } from "next/navigation";

import { ProfileCard } from "@/components/profile-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Band, Button } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { fetchPublicProfile } from "@/lib/profile";

type Props = { params: Promise<{ id: string }> };

// Profiles belong to students (minors): signed-in visitors only, never indexed.
export const metadata = { title: "โปรไฟล์ · pipoltutor", robots: { index: false, follow: false } };

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/u/${id}`)}`);
  const profile = await fetchPublicProfile(id);
  if (!profile) notFound();

  return (
    <>
      <SiteHeader current="exam" app />
      <main className="flex-1">
        <Band className="pb-14 pt-10 md:pb-[72px]">
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            <ProfileCard
              name={profile.name}
              bio={profile.bio}
              photo={profile.photo}
              joinedAt={profile.joinedAt}
              highestFire={profile.highestFire}
              certificates={profile.certificates}
              action={profile.isMe ? <Button href="/profile" kind="ghost" icon="edit" size="sm">แก้ไขโปรไฟล์</Button> : undefined}
            />
          </div>
        </Band>
      </main>
      <SiteFooter />
    </>
  );
}
