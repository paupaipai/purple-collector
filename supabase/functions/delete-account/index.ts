import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { SignJWT, importPKCS8 } from "npm:jose@5";

// Apple's client_secret for both the token-exchange and revoke calls is the
// same short-lived ES256 JWT — no need to mint a new one per call, it just
// has to still be unexpired (we give it 5 min, both calls happen in series).
async function buildAppleClientSecret(): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID");
  let privateKey = Deno.env.get("APPLE_PRIVATE_KEY");

  if (!teamId || !keyId || !bundleId || !privateKey) {
    throw new Error("Missing Apple secret(s): APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_BUNDLE_ID/APPLE_PRIVATE_KEY");
  }
  // Guards against the common footgun of pasting a .p8 into a Supabase secret
  // and its newlines surviving as literal "\n" instead of real line breaks.
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience("https://appleid.apple.com")
    .setSubject(bundleId)
    .sign(key);
}

async function revokeAppleToken(authorizationCode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const bundleId = Deno.env.get("APPLE_BUNDLE_ID")!;
    const clientSecret = await buildAppleClientSecret();

    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authorizationCode,
        client_id: bundleId,
        client_secret: clientSecret,
      }),
    });
    const tokenBody = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenBody.refresh_token) {
      console.error("[delete-account] Apple token exchange failed:", tokenRes.status, tokenBody);
      return { ok: false, error: "Apple token exchange failed" };
    }

    const revokeRes = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: tokenBody.refresh_token,
        token_type_hint: "refresh_token",
        client_id: bundleId,
        client_secret: clientSecret,
      }),
    });
    if (!revokeRes.ok) {
      console.error("[delete-account] Apple token revoke failed:", revokeRes.status, await revokeRes.text());
      return { ok: false, error: "Apple token revoke failed" };
    }

    return { ok: true };
  } catch (err) {
    console.error("[delete-account] Apple revoke flow threw:", err);
    return { ok: false, error: "Apple revoke flow failed" };
  }
}

// auth: ["user"] forces a verified end-user JWT (checked against the project's
// JWKS by withSupabase itself) — ctx.userClaims.id is the caller's own id,
// never a value the client can pass in. This is what stops anyone from
// deleting an account other than their own.
export default {
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const appleAuthorizationCode = typeof body.appleAuthorizationCode === "string"
      ? body.appleAuthorizationCode
      : undefined;

    // Revoke first, before touching any data. If this fails we must stop here —
    // otherwise we'd end up with the account gone from our DB but still alive
    // (and still listed under "Sign in with Apple") on Apple's side.
    if (appleAuthorizationCode) {
      const revoked = await revokeAppleToken(appleAuthorizationCode);
      if (!revoked.ok) {
        return Response.json(
          { success: false, error: `Could not revoke Apple token: ${revoked.error}` },
          { status: 500 },
        );
      }
    }

    // ctx.supabaseAdmin uses the service_role key (bypasses RLS) — every
    // delete below targets only `userId`, which came from the verified JWT.

    const { error: cardsError } = await ctx.supabaseAdmin
      .from("user_cards")
      .delete()
      .eq("user_id", userId);

    if (cardsError) {
      console.error("[delete-account] user_cards delete failed:", cardsError);
      return Response.json(
        { success: false, error: "Could not delete user's collection" },
        { status: 500 },
      );
    }

    const { error: profileError } = await ctx.supabaseAdmin
      .from("user_profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error("[delete-account] user_profiles delete failed:", profileError);
      return Response.json(
        { success: false, error: "Could not delete user profile" },
        { status: 500 },
      );
    }

    // Last step on purpose: only remove the auth user once the app data
    // tied to that id is confirmed gone.
    const { error: authError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error("[delete-account] auth.admin.deleteUser failed:", authError);
      return Response.json(
        { success: false, error: "Could not delete auth account" },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  }),
};
