import type { Instrumentation } from "next";

/**
 * Server errors on the live site are recorded for /platform/system, and the
 * first of each kind in an hour is emailed to info@flowacord.com
 * (lib/platform/errors.ts). Production only: a developer's own mistakes
 * on their machine shouldn't email anyone.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { recordServerError } = await import("@/lib/platform/errors");
  await recordServerError({
    error,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
