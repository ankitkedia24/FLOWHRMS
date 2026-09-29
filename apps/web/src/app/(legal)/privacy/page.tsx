import type { Metadata } from "next";
import Link from "next/link";
import { DocumentView } from "@/components/consent/DocumentView";
import { CURRENT_DOCUMENTS } from "@/lib/consent/documents";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <DocumentView doc={CURRENT_DOCUMENTS.privacy} headingLevel={1} />
      <section className="rounded-md border border-border-default bg-surface-default p-4">
        <h2 className="font-heading text-body-lg font-semibold text-text-primary">
          Notices you may be asked to accept
        </h2>
        <ul className="mt-2 flex flex-col gap-1 text-body">
          <li>
            <Link href="/privacy/notice/account_holder" className="text-brand-primary underline-offset-2 hover:underline">
              Privacy notice for your FlowHRMS account
            </Link>
          </li>
          <li>
            <Link href="/privacy/notice/customer_terms" className="text-brand-primary underline-offset-2 hover:underline">
              Registering a company on FlowHRMS
            </Link>
          </li>
          <li>
            <Link href="/privacy/notice/employee" className="text-brand-primary underline-offset-2 hover:underline">
              Notice to employees
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
