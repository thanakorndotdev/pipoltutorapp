"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

import type { SiteAsset, SiteAssets, SiteTexts } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { makeCopy, type Copy } from "@/lib/site-texts";

const SiteAssetsContext = createContext<SiteAssets>({});
const SiteCopyContext = createContext<Copy>(makeCopy({}));
const SessionContext = createContext<SessionUser | null>(null);

/** Root layout fetches /site/assets, /site/texts and /auth/me once per request and hands them down here. */
export function SiteAssetsProvider({
  assets,
  texts,
  user,
  children,
}: {
  assets: SiteAssets;
  texts: SiteTexts;
  user: SessionUser | null;
  children: ReactNode;
}) {
  return (
    <SiteAssetsContext.Provider value={assets}>
      <SiteCopyContext.Provider value={makeCopy(texts)}>
        <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
      </SiteCopyContext.Provider>
    </SiteAssetsContext.Provider>
  );
}

/** Client components: the signed-in user, or null. */
export function useSessionUser(): SessionUser | null {
  return useContext(SessionContext);
}

export function useSiteAsset(slot: string): SiteAsset | undefined {
  return useContext(SiteAssetsContext)[slot];
}

/** Client components: same helpers as getCopy() on the server. */
export function useCopy(): Copy {
  return useContext(SiteCopyContext);
}

/**
 * Renders the admin-uploaded image for `slot`, or `children` (the design's
 * placeholder Slot) when none is set. `ratio` and `className` mirror the
 * placeholder so the layout does not shift between the two.
 */
export function SiteImage({
  slot,
  ratio = "4 / 3",
  className = "",
  imgClass = "",
  children,
}: {
  slot: string;
  ratio?: string;
  className?: string;
  imgClass?: string;
  children: ReactNode;
}) {
  const asset = useSiteAsset(slot);
  if (!asset) return <>{children}</>;
  const style: CSSProperties = { aspectRatio: ratio };
  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary hosts; sized by aspect-ratio
    <img
      src={asset.imageUrl}
      alt={asset.alt}
      className={`block w-full max-w-full rounded-[28px] object-cover ${className} ${imgClass}`}
      style={style}
    />
  );
}
