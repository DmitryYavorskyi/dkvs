import { createClient } from "npm:@supabase/supabase-js@2";

const origin = "https://dmitryyavorskyi.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const accessToken = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json({ error: "Authentication required" }, 401);

  let body: { login_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const loginName = typeof body.login_name === "string" ? body.login_name.trim().toLocaleLowerCase("uk-UA") : "";
  if (!loginName || loginName.length > 50 || loginName.includes("\n") || loginName.includes("\r")) {
    return json({ error: "Invalid login nickname" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeysText = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  let publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!publishableKey && publishableKeysText) {
    try {
      const keyMap = JSON.parse(publishableKeysText);
      publishableKey = keyMap.default || Object.values(keyMap)[0] || "";
    } catch {
      return json({ error: "Supabase function configuration is invalid" }, 500);
    }
  }
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: "Supabase function configuration is incomplete" }, 500);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Authentication required" }, 401);
  const { data: isOwner, error: roleError } = await caller.rpc("dkvs_is_owner");
  if (roleError || isOwner !== true) return json({ error: "Owner access required" }, 403);

  const { data: profile, error: profileError } = await caller
    .from("dkvs_profiles")
    .select("user_id, login_name")
    .eq("login_name", loginName)
    .eq("active", true)
    .maybeSingle();
  if (profileError) return json({ error: "Could not find the account" }, 500);
  if (!profile) return json({ error: "Active employee account not found" }, 404);

  const accessCode = crypto.randomUUID();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: updateError } = await admin.auth.admin.updateUserById(profile.user_id, { password: accessCode });
  if (updateError) {
    console.error("Could not replace account access code", updateError.message);
    return json({ error: "Could not replace account access code" }, 500);
  }

  return json({ code: accessCode, login_name: profile.login_name });
});
