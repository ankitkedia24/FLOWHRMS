import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { SUPPORT_COOKIE } from "@/lib/auth/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Sign out and return to sign-in. */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const supportId = (await cookies()).get(SUPPORT_COOKIE)?.value;
  if (supabase) {
    // A Flowacord person signing out ends the support session they had open.
    if (supportId) {
      const authUser = (await supabase.auth.getUser()).data.user;
      const user = authUser ? await getDb().user.findUnique({ where: { authUserId: authUser.id } }) : null;
      if (user && /^[0-9a-f-]{36}$/i.test(supportId)) {
        await getDb().supportSession.updateMany({
          where: { id: supportId, platformUserId: user.id, endedAt: null },
          data: { endedAt: new Date() },
        });
      }
    }
    await supabase.auth.signOut();
  }

  // A RELATIVE Location on purpose. This used to be
  // `NextResponse.redirect(new URL("/sign-in", request.url))` — but behind
  // the host's reverse proxy, `request.url` is the server's internal bind
  // address, so signing out sent the browser to https://0.0.0.0:3000 and
  // an unreachable page. The browser resolves a relative Location against
  // whatever origin it actually used, which is proxy-proof by
  // construction. (NextResponse.redirect refuses relative URLs; a plain
  // Response does not.)
  const headers = new Headers({ Location: "/sign-in" });
  if (supportId) headers.append("Set-Cookie", `${SUPPORT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return new Response(null, { status: 303, headers });
}
