import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const keyMapText = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  let publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!publishableKey && keyMapText) {
    try {
      const keyMap = JSON.parse(keyMapText);
      publishableKey = keyMap.default || Object.values(keyMap)[0] || "";
    } catch {
      return json({ error: "Supabase function configuration is invalid" }, 500);
    }
  }
  if (!supabaseUrl || !publishableKey) {
    return json({ error: "Supabase function configuration is incomplete" }, 500);
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Authentication required" }, 401);

  const { data: isOwner, error: roleError } = await client.rpc("dkvs_is_owner");
  if (roleError || isOwner !== true) return json({ error: "Owner access required" }, 403);

  let body: { code?: unknown; login_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const inviteCode = typeof body.code === "string" ? body.code.trim() : "";
  const loginName = typeof body.login_name === "string" ? body.login_name.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode)) {
    return json({ error: "Invalid invitation code" }, 400);
  }
  if (!loginName || loginName.length > 50 || /[\r\n]/.test(loginName)) {
    return json({ error: "Invalid login nickname" }, 400);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) return json({ error: "Telegram is not configured" }, 503);

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Код-запрошення ДКВС: ${inviteCode}\nДійсний для однієї реєстрації.`,
    }),
  });
  if (!telegramResponse.ok) {
    console.error("Telegram sendMessage failed with status", telegramResponse.status);
    return json({ error: "Telegram message could not be sent" }, 502);
  }

  return json({ sent: true });
});
