"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Print, or "Save as PDF" from the print dialog, for handing over. */
export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      leadingIcon={<Printer aria-hidden="true" />}
      onClick={() => window.print()}
    >
      Print or save as PDF
    </Button>
  );
}
