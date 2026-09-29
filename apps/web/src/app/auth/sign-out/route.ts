import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Sign out and return to sign-in. */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  // A RELATIVE Location on purpose. This used to be
  // `NextResponse.redirect(new URL("/sign-in", request.url))` — but behind
  // the host's reverse proxy, `request.url` is the server's internal bind
  // address, so signing out sent the browser to https://0.0.0.0:3000 and
  // an unreachable page. The browser resolves a relative Location against
  // whatever origin it actually used, which is proxy-proof by
  // construction. (NextResponse.redirect refuses relative URLs; a plain
  // Response does not.)
  return new Response(null, {
    status: 303,
    headers: { Location: "/sign-in" },
  });
}
