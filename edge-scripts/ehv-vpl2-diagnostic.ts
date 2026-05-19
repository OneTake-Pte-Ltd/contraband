import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

/**
 * EHV VPL2 Diagnostic — Bunny Edge Script
 *
 * Endpoints:
 *   POST /diagnose  — proxy to Anthropic API, return AI diagnosis JSON
 *   POST /track     — fire DiagnosticCompleted event to UserList
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   USERLIST_PUSH_KEY   — UserList Push API key  (Authorization: Push ...)
 *   USERLIST_REST_KEY   — UserList REST API key  (Authorization: Bearer ...)
 */

const ALLOWED_ORIGIN = "https://contraband.onetake.ai";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

// Simple in-memory rate limiter: 1 /diagnose request per IP per minute
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

const SYSTEM_PROMPT = `Tu es le Diagnostic des Business d'Expert, un outil créé par Sébastien Night, fondateur de OneTake AI.
Ton rôle est d'analyser les réponses d'un expert (coach, consultant, formateur, thérapeute) à un questionnaire sur son business, et de rédiger un diagnostic personnalisé, honnête et bienveillant.

## Contexte

Le client vient de regarder une vidéo de formation intitulée "les 5 piliers d'un business d'expert". Il a reçu cette explication :

Pilier 1 — Positionnement d'un Mécanisme Unique. Devenir la seule réponse à un problème précis pour un type de personne précis, grâce à une méthode qui n'appartient qu'à toi. Un bon positionnement te rend incomparable. Sans lui, tu es en compétition avec ChatGPT tant que ton message reste vague.

Pilier 2 — Offre Irrésistible. Packager ta transformation à son juste prix, avec des éléments que personne d'autre ne propose. Une offre packagée à prix fixe te sort du piège temps-contre-argent.

Pilier 3 — Audience & Visibilité. Avoir un message clivant et un système de contenu régulier. Sans visibilité, ton positionnement et ton offre restent un secret bien gardé. Ce n'est pas une question de talent — c'est une question de système.

Pilier 4 — Machine à Vendre. Un tunnel automatisé (lead magnet → séquence email → page de vente) qui transforme des inconnus en clients 24h/24. Sans lui, chaque euro de CA coûte du temps en prospection active.

Pilier 5 — Notoriété. Partenariats, publicité et leadership de marché pour amplifier tout le système. C'est le multiplicateur — il ne fonctionne que si les 4 premiers piliers sont solides.

## Inputs

Les scores que tu reçois viennent des réponses de l'utilisateur à un questionnaire de 17 questions. Pour chaque pilier tu reçois le score brut, le maximum possible, et le pourcentage.

## Comportement selon le pilier goulot

Pilier 1 (Positionnement) : insiste sur le coût de l'invisibilité par généralité — l'expert est en compétition avec ChatGPT tant qu'il reste vague. La solution n'est pas de poster plus, c'est de trouver son Mécanisme Unique.

Pilier 2 (Offre) : insiste sur le piège du temps contre argent. Un expert sans offre packagée plafonne toujours, peu importe son niveau de compétence ou sa visibilité.

Pilier 3 (Audience & Visibilité) : insiste sur le fait que le meilleur positionnement du monde reste un secret bien gardé sans contenu régulier. Ce n'est pas une question de talent — c'est une question de système.

Pilier 4 (Machine à Vendre) : insiste sur le fait que sans tunnel automatisé, chaque euro de chiffre d'affaires coûte du temps en prospection active. Le business ne peut pas scaler.

Pilier 5 (Notoriété) : valider que les 4 premiers piliers sont déjà solides est une bonne nouvelle. Le prochain levier est l'amplification — partenariats, publicité, leadership de marché.

## Format de réponse attendu

Tu réponds UNIQUEMENT en JSON valide, sans balises Markdown, sans commentaires, sans texte avant ou après. Structure exacte :

{
  "bottleneck_name": "<nom court du pilier goulot>",
  "bottleneck_intro": "<1 phrase percutante qui nomme le problème sans détour, en s'adressant directement à l'utilisateur avec 'tu'>",
  "why_this_pillar": "<2-3 paragraphes séparés par \\n\\n qui expliquent pourquoi ce pilier est le goulot, en citant précisément les réponses de l'utilisateur>",
  "what_happens_without_it": "<1 paragraphe court — la conséquence concrète de ne pas régler ce pilier en premier>",
  "first_move": "<1 paragraphe — la première action concrète à faire sur ce pilier cette semaine>",
  "encouragement": "<1-2 phrases — une note d'encouragement sincère qui reconnaît le chemin déjà parcouru>"
}

## Règles de ton et de style

- Tu t'adresses à la personne en utilisant "tu" tout au long (pas "vous")
- Tu es Sébastien Night qui parle — direct, expérimenté, pas académique
- Tu ne génères jamais de bullet points ni de listes dans ta réponse — uniquement de la prose fluide
- Chaque réponse est unique et personnalisée : le domaine d'expertise et les scores individuels doivent transparaître dans le texte
- Le champ "why_this_pillar" doit mentionner au moins deux réponses spécifiques de l'utilisateur par leur contenu
- Tu ne conclus jamais par une vente forcée — l'encouragement est sincère, pas un pitch
- Tu écris dans la langue spécifiée dans le champ "language" des inputs`;

// ── CORS helpers ────────────────────────────────────────────
function corsHeaders(origin: string | null): Headers {
  const allowed = origin === ALLOWED_ORIGIN || origin === "http://localhost:8080" || origin?.includes("localhost")
    ? origin
    : ALLOWED_ORIGIN;
  return new Headers({
    "Access-Control-Allow-Origin": allowed || ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
}

function json(data: unknown, status = 200, origin: string | null = null): Response {
  const h = corsHeaders(origin);
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers: h });
}

function err(msg: string, status = 400, origin: string | null = null): Response {
  return json({ error: msg }, status, origin);
}

// ── Rate limiter ────────────────────────────────────────────
function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(ip, now);
  // Prune old entries to prevent unbounded growth
  if (rateLimitMap.size > 2000) {
    const cutoff = now - RATE_LIMIT_MS * 2;
    for (const [k, v] of rateLimitMap) {
      if (v < cutoff) rateLimitMap.delete(k);
    }
  }
  return false;
}

// ── /diagnose handler ───────────────────────────────────────
async function handleDiagnose(body: unknown, origin: string | null, ip: string): Promise<Response> {
  if (isRateLimited(ip)) {
    return err("Rate limit: 1 diagnostic per minute. Please wait.", 429, origin);
  }

  const payload = body as { answers?: unknown };
  if (!payload?.answers) return err("answers is required", 400, origin);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY");
    return err("Server configuration error", 500, origin);
  }

  const userMessage = JSON.stringify(payload.answers, null, 2);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch (e) {
    console.error("Anthropic fetch error:", e);
    return err("Upstream API unreachable", 502, origin);
  }

  if (!anthropicRes.ok) {
    const txt = await anthropicRes.text().catch(() => "");
    console.error("Anthropic error:", anthropicRes.status, txt);
    return err("Upstream API error: " + anthropicRes.status, 502, origin);
  }

  let anthropicData: { content?: Array<{ type: string; text: string }> };
  try {
    anthropicData = await anthropicRes.json();
  } catch (e) {
    return err("Failed to parse upstream response", 502, origin);
  }

  const text = anthropicData?.content?.[0]?.text;
  if (!text) return err("Empty response from upstream", 502, origin);

  // Strip possible markdown code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let diagnosis: unknown;
  try {
    diagnosis = JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse error, raw:", cleaned.slice(0, 200));
    return err("Diagnosis response was not valid JSON", 502, origin);
  }

  return json(diagnosis, 200, origin);
}

// ── UserList helpers (matching VPL1 pattern) ────────────────
async function findUser(
  email: string,
  restKey: string
): Promise<{ identifier: string; email: string } | null> {
  const url = "https://api.userlist.com/v2/users?filter[email_address]=" + encodeURIComponent(email);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${restKey}` },
  });
  if (!res.ok) {
    console.error("UserList REST lookup failed:", res.status);
    return null;
  }
  let data: { data?: unknown[] };
  try { data = await res.json(); } catch { return null; }
  const users: Array<{ identifier?: string; email_address?: string; last_seen_at?: string }> =
    Array.isArray(data) ? data : (data?.data ?? []) as typeof users;
  if (!users.length) return null;
  const withId = users.filter((u) => u.identifier && String(u.identifier).trim() !== "");
  const pool = withId.length > 0 ? withId : users;
  pool.sort((a, b) => {
    const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return tb - ta;
  });
  const best = pool[0];
  return { identifier: best.identifier || email, email: best.email_address || email };
}

interface TrackPayload {
  name?: string;
  user: { email: string };
  properties?: Record<string, unknown>;
}

async function handleTrack(body: TrackPayload, origin: string | null, pushKey: string, restKey: string): Promise<Response> {
  const email = body?.user?.email;
  if (!email) return err("user.email is required", 400, origin);

  const found = await findUser(email, restKey);
  const userPayload = found
    ? { identifier: found.identifier, email: found.email }
    : { email };

  const eventBody = {
    name: "DiagnosticCompleted",
    user: userPayload,
    properties: {
      ...(body.properties || {}),
      url: "https://contraband.onetake.ai/ehv/vpl2-diagnostic/",
    },
  };

  const res = await fetch("https://push.userlist.com/events", {
    method: "POST",
    headers: {
      Authorization: `Push ${pushKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("UserList push error:", res.status, txt);
    return err("UserList push error: " + res.status, res.status, origin);
  }

  let responseData: unknown = null;
  try { responseData = await res.json(); } catch { /* empty body is fine */ }
  return json(responseData || { success: true }, 200, origin);
}

// ── Main handler ────────────────────────────────────────────
BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || "unknown";

  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return err("Method not allowed. Use POST.", 405, origin);
    }

    const pushKey = process.env.USERLIST_PUSH_KEY;
    const restKey = process.env.USERLIST_REST_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      console.error("Missing ANTHROPIC_API_KEY");
      return err("Server configuration error", 500, origin);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err("Invalid JSON body", 400, origin);
    }

    const p = url.pathname;

    if (p === "/diagnose" || p.endsWith("/diagnose")) {
      return handleDiagnose(body, origin, ip);
    }

    if ((p === "/track" || p.endsWith("/track")) && pushKey && restKey) {
      return handleTrack(body as TrackPayload, origin, pushKey, restKey);
    }

    if (p === "/track" || p.endsWith("/track")) {
      console.error("Missing USERLIST_PUSH_KEY or USERLIST_REST_KEY");
      return err("Server configuration error", 500, origin);
    }

    return err("Unknown endpoint: " + p, 404, origin);
  } catch (e) {
    console.error("Unexpected error:", e);
    return err("Internal server error", 500, origin);
  }
});
