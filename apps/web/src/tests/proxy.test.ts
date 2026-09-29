import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The proxy must never redirect anyone away from /sign-in.
 *
 * It knows only that Supabase recognises a visitor. Whether they have a
 * usable FlowHRMS account is a database question — and the two come apart
 * routinely: a deactivated employee, a membership removed, a tenant
 * closed, an invited user whose record is not yet linked. Every one of
 * those has a valid auth cookie and a null app session.
 *
 * While the proxy bounced /sign-in to "/", that gap was a lockout. "/"
 * found no app session, sent them to the marketing page, and the only
 * way on from there is its Sign in link — straight back to the bounce.
 * No error, no way in, and no way out either, because sign-out lives
 * inside the app they cannot open.
 *
 * Reported as "the sign in button just reloads the main page", which is
 * exactly what a redirect loop that returns to its origin looks like.
 */

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

const { default: proxy } = await import("@/proxy");

function request(path: string) {
  return new NextRequest(new URL(path, "https://flowhrms.example.com"));
}

/** What the proxy does with a request: pass it through, or send it away. */
function destinationOf(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  vi.stubEnv("FLOWHRMS_DEV_FAKE_SESSION", "");
  getUser.mockReset();
});

function signedInToSupabase() {
  getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}

describe("proxy", () => {
  it("lets a Supabase-authenticated visitor reach /sign-in", async () => {
    signedInToSupabase();
    expect(destinationOf(await proxy(request("/sign-in")))).toBeNull();
  });

  it("lets a signed-out visitor reach /sign-in", async () => {
    signedOut();
    expect(destinationOf(await proxy(request("/sign-in")))).toBeNull();
  });

  it("does not send /sign-in to a page that sends it back", async () => {
    // The loop had two legs. This asserts the first can never return.
    signedInToSupabase();
    const destination = destinationOf(await proxy(request("/sign-in")));
    expect(destination).not.toBe("/");
    expect(destination).not.toBe("/product");
  });

  it("still sends a signed-out visitor away from a protected page", async () => {
    signedOut();
    const response = await proxy(request("/admin/employees"));
    expect(destinationOf(response)).toBe("/sign-in");
    expect(
      new URL(response.headers.get("location")!).searchParams.get("next"),
    ).toBe("/admin/employees");
  });

  it("lets a signed-in visitor through to a protected page", async () => {
    signedInToSupabase();
    expect(destinationOf(await proxy(request("/admin")))).toBeNull();
  });

  it("leaves the root path alone in both directions", async () => {
    // "/" routes by role in the page itself, so the proxy must not guess.
    signedOut();
    expect(destinationOf(await proxy(request("/")))).toBeNull();
    signedInToSupabase();
    expect(destinationOf(await proxy(request("/")))).toBeNull();
  });

  it("serves marketing pages without asking the auth server at all", async () => {
    // A Supabase outage must not take the public site down with it.
    getUser.mockRejectedValue(new Error("auth server is down"));
    for (const path of ["/product", "/pricing", "/modules", "/demo"]) {
      expect(destinationOf(await proxy(request(path)))).toBeNull();
    }
    expect(getUser).not.toHaveBeenCalled();
  });

  it("lets invitation links through — the token is the credential", async () => {
    signedOut();
    expect(
      destinationOf(await proxy(request("/invite/some-long-token"))),
    ).toBeNull();
  });

  it("fails open when the auth server hangs", async () => {
    // Bounded wait, then let the page's own guard decide. Failing closed
    // would sign everyone out during a blip.
    getUser.mockImplementation(() => new Promise(() => {}));
    const response = await proxy(request("/admin"));
    expect(destinationOf(response)).toBeNull();
  }, 10_000);

  it("keeps everything but marketing reachable with Supabase unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(destinationOf(await proxy(request("/admin")))).toBe("/product");
    expect(destinationOf(await proxy(request("/sign-in")))).toBeNull();
  });
});
