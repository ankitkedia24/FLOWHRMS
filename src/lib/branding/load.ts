import "server-only";

import { cache } from "react";
import { getDb } from "@/lib/db";
import { mediaUrls } from "@/lib/media/urls";

export interface Branding {
  logoUrl: string | null;
  /** The opening animation, when the company has switched it on. */
  splash: { url: string; mime: string; version: string } | null;
}

/** The company's logo and opening animation, as links valid for an hour. Once per request. */
export const loadBranding = cache(async (tenantId: string): Promise<Branding> => {
  const tenant = await getDb().tenant.findUnique({
    where: { id: tenantId },
    select: { logoPath: true, splashPath: true, splashMime: true, splashEnabled: true },
  });
  if (!tenant) return { logoUrl: null, splash: null };
  const splashOn = tenant.splashEnabled && tenant.splashPath && tenant.splashMime;
  const urls = await mediaUrls([tenant.logoPath, splashOn ? tenant.splashPath : null]);
  const splashUrl = splashOn ? urls.get(tenant.splashPath!) : undefined;
  return {
    logoUrl: tenant.logoPath ? (urls.get(tenant.logoPath) ?? null) : null,
    splash: splashUrl ? { url: splashUrl, mime: tenant.splashMime!, version: tenant.splashPath! } : null,
  };
});

/** For the settings screen: the animation even while it is switched off. */
export async function loadSettingsBranding(tenantId: string): Promise<{
  logoUrl: string | null;
  splash: { url: string; mime: string; enabled: boolean } | null;
}> {
  const tenant = await getDb().tenant.findUnique({
    where: { id: tenantId },
    select: { logoPath: true, splashPath: true, splashMime: true, splashEnabled: true },
  });
  if (!tenant) return { logoUrl: null, splash: null };
  const urls = await mediaUrls([tenant.logoPath, tenant.splashPath]);
  const splashUrl = tenant.splashPath ? urls.get(tenant.splashPath) : undefined;
  return {
    logoUrl: tenant.logoPath ? (urls.get(tenant.logoPath) ?? null) : null,
    splash:
      splashUrl && tenant.splashMime
        ? { url: splashUrl, mime: tenant.splashMime, enabled: tenant.splashEnabled }
        : null,
  };
}
