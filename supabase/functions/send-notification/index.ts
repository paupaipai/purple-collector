import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// The admin panel is a web app, unlike delete-account's mobile-only caller,
// so it needs real CORS handling (preflight + headers on the actual response).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ExpoTicket = { status: "ok" | "error"; id?: string; message?: string };

// Expo caps a single push request at 100 messages, so callers with more
// tokens than that must be chunked into several requests.
async function sendExpoPushChunk(messages: Record<string, unknown>[]): Promise<{ okCount: number }> {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data) {
    console.error("[send-notification] Expo push chunk failed:", res.status, body);
    return { okCount: 0 };
  }

  const okCount = (body.data as ExpoTicket[]).filter((ticket) => ticket.status === "ok").length;
  return { okCount };
}

// auth: ["user"] forces a verified end-user JWT (checked against the project's
// JWKS by withSupabase itself) — ctx.userClaims.id is the caller's own id.
// The is_admin check below is what actually restricts who can broadcast.
const protectedHandler = withSupabase({ auth: ["user"] }, async (req, ctx) => {
  const userId = ctx.userClaims?.id;
  if (!userId) {
    return Response.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await ctx.supabaseAdmin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.is_admin) {
    return Response.json({ success: false, error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";
  const data = body.data && typeof body.data === "object"
    ? (body.data as Record<string, unknown>)
    : undefined;

  if (!title || !messageBody) {
    return Response.json({ success: false, error: "title and body are required" }, { status: 400 });
  }

  // service_role select bypasses RLS on purpose — push_tokens has no select
  // policy for regular users, only this function is meant to read it in bulk.
  const { data: tokenRows, error: tokensError } = await ctx.supabaseAdmin
    .from("push_tokens")
    .select("token");

  if (tokensError) {
    console.error("[send-notification] push_tokens select failed:", tokensError);
    return Response.json({ success: false, error: "Could not load push tokens" }, { status: 500 });
  }

  const tokens = Array.from(new Set((tokenRows ?? []).map((row) => row.token as string))).filter(Boolean);

  let sent = 0;
  const CHUNK_SIZE = 100;
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE).map((token) => ({
      to: token,
      title,
      body: messageBody,
      data,
      sound: "default",
    }));
    const { okCount } = await sendExpoPushChunk(chunk);
    sent += okCount;
  }

  // Best-effort: the push already went out, so a logging failure shouldn't
  // turn into an error response for the admin caller.
  const { error: logError } = await ctx.supabaseAdmin.from("notifications_log").insert({
    title,
    body: messageBody,
    data: data ?? null,
    sent_by: userId,
    recipients_count: sent,
  });
  if (logError) {
    console.error("[send-notification] notifications_log insert failed:", logError);
  }

  return Response.json({ success: true, sent });
});

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const res = await protectedHandler(req);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
    return new Response(res.body, { status: res.status, headers });
  },
};
