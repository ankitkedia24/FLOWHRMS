import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/consent/DocumentView";
import { CURRENT_DOCUMENTS, type DocumentKey } from "@/lib/consent/documents";

const NOTICES: DocumentKey[] = ["account_holder", "customer_terms", "employee"];

export const metadata: Metadata = { title: "Privacy notice" };

/** A consent notice on its own page — Rule 3(a): understandable independently. */
export default async function NoticePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  if (!NOTICES.includes(key as DocumentKey)) notFound();
  return <DocumentView doc={CURRENT_DOCUMENTS[key as DocumentKey]} headingLevel={1} />;
}
