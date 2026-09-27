"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button
      size="sm"
      variant="secondary"
      leadingIcon={<Printer className="size-4" aria-hidden="true" />}
      onClick={() => window.print()}
    >
      Print or save as PDF
    </Button>
  );
}
