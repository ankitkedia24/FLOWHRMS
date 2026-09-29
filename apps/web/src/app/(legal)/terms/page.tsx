import type { Metadata } from "next";
import { DocumentView } from "@/components/consent/DocumentView";
import { CURRENT_DOCUMENTS } from "@/lib/consent/documents";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return <DocumentView doc={CURRENT_DOCUMENTS.terms} headingLevel={1} />;
}
