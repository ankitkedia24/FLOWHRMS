import "server-only";

import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { normalizeFieldVisitsPolicy, type FieldVisitsPolicy } from "./policy";

export interface PublishedFieldVisitsPolicy {
  policy: FieldVisitsPolicy;
  version: number;
}

/**
 * The company's published field visit rules, or null before the first
 * publish — nothing can be recorded until then (FIELD-VISITS-MODULE.md).
 */
export async function loadFieldVisitsPolicy(
  tenantId: string,
): Promise<PublishedFieldVisitsPolicy | null> {
  const raw = await getPolicy<unknown>(tenantId, "field_visits");
  if (!raw) return null;
  const version = await getPolicyVersion(tenantId, "field_visits");
  return { policy: normalizeFieldVisitsPolicy(raw), version };
}
