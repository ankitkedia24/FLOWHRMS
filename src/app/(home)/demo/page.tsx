import { redirect } from "next/navigation";

/**
 * The old "Request a demo" page. Every company now starts a free trial on
 * its own, so this address — still in old links, emails and search
 * results — goes straight to the sign-up page. Enquiries already received
 * stay in /platform/enquiries.
 */
export default function DemoPage() {
  redirect("/start");
}
