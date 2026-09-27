import "server-only";

/**
 * PAUSED (28 Sept 2026, owner's decision): email/mobile one-time codes at
 * sign-up are built but not wired into /start. Nothing imports this file.
 * Resume only when the owner asks; mobile needs MSG91 keys (see msg91.ts).
 */

/**
 * One-time codes by SMS, through MSG91 (India, DLT-registered).
 *
 * Needs MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID (DEPLOY.md §7e). The
 * template is the DLT-approved OTP message set up in MSG91, e.g. "Your
 * FlowHRMS verification code is ##OTP##. It is valid for 10 minutes. -
 * Flowacord"; we generate and check the code ourselves and only ask MSG91
 * to deliver it. Until both are set, mobile verification is simply off.
 */

export function smsConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY?.trim() && process.env.MSG91_OTP_TEMPLATE_ID?.trim());
}

export async function sendOtpSms(mobile10: string, code: string): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.MSG91_AUTH_KEY?.trim();
  const template = process.env.MSG91_OTP_TEMPLATE_ID?.trim();
  if (!key || !template) return { sent: false, reason: "SMS isn't set up yet." };
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", template);
  url.searchParams.set("mobile", `91${mobile10}`);
  url.searchParams.set("otp", code);
  url.searchParams.set("otp_expiry", "10");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authkey: key, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || data.type === "error") {
      return { sent: false, reason: data.message ?? `SMS provider answered ${res.status}.` };
    }
    return { sent: true };
  } catch {
    return { sent: false, reason: "The SMS service didn't answer." };
  }
}
