import { z } from "zod";
import { STATES_AND_UTS } from "@/lib/signup/catalog";
import type { AppSession } from "@/lib/auth/types";
import { isGstin, stateForGstin } from "./pricing";

/**
 * Who may see the plan and pay for it: the Owner, and the two admin roles
 * the Owner hands company matters to — Super Admin (company
 * settings) and Admin. Managers, HR and staff never see prices or invoices.
 */
export function canManageBilling(session: Pick<AppSession, "membership" | "permissions">): boolean {
  return (
    session.membership.roleKey === "OWNER" ||
    session.membership.roleKey === "ADMIN" ||
    session.permissions.has("settings.manage")
  );
}

export const buyerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the name for the invoice.").max(120),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .max(15)
      .refine((v) => v === "" || isGstin(v), "That GSTIN doesn't look right. Check it, or leave it empty."),
    address: z.string().trim().min(5, "Enter the address for the invoice.").max(300),
    city: z.string().trim().min(2, "Enter the city.").max(80),
    state: z.enum(STATES_AND_UTS, { error: "Choose the state." }),
    pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a 6-digit pincode."),
  })
  .superRefine((v, ctx) => {
    // Place of supply for a registered buyer is where it is registered.
    if (v.gstin && stateForGstin(v.gstin) !== v.state) {
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: `This GSTIN is registered in ${stateForGstin(v.gstin)}. Choose that state.`,
      });
    }
  });

export type BuyerInput = z.input<typeof buyerSchema>;
