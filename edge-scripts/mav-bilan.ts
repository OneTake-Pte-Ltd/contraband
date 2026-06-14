import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

/**
 * MAV Bilan — Bunny Edge Script
 *
 * Endpoints:
 *   POST /api/bilan  — proxy to OpenAI API, return AI assessment JSON
 *   POST /track      — fire ViewContent event to UserList
 *
 * Environment variables:
 *   OPENAI_API_KEY     — OpenAI API key
 *   USERLIST_PUSH_KEY  — UserList Push API key  (Authorization: Push ...)
 */

const ALLOWED_ORIGIN = "https://contraband.onetake.ai";
const MODEL = "gpt-4o-mini";
const BILAN_URL = "https://contraband.onetake.ai/mav/bilan/";

const ASSESSMENT_SCHEMA = {
  name: "free_entrepreneur_assessment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      profile: {
        type: "object",
        properties: {
          score:       { type: "number" },
          description: { type: "string" },
        },
        required: ["score", "description"],
        additionalProperties: false,
      },
      dormantAssets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:        { type: "string" },
            potential:   { type: "string", enum: ["high", "medium", "low"] },
            description: { type: "string" },
          },
          required: ["name", "potential", "description"],
          additionalProperties: false,
        },
      },
      torrentCost: {
        type: "object",
        properties: {
          hoursPerWeek: { type: "number" },
          weeksPerYear: { type: "number" },
          humanImpact:  { type: "string" },
        },
        required: ["hoursPerWeek", "weeksPerYear", "humanImpact"],
        additionalProperties: false,
      },
      priorityLevers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title:       { type: "string" },
            description: { type: "string" },
          },
          required: ["title", "description"],
          additionalProperties: false,
        },
      },
      bridgeSentence: { type: "string" },
    },
    required: ["profile", "dormantAssets", "torrentCost", "priorityLevers", "bridgeSentence"],
    additionalProperties: false,
  },
};

// Simple in-memory rate limiter: 1 /api/bilan request per IP per minute
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

const SYSTEM_PROMPT = `You are OneTake, an AI agent created by OneTake AI.

Your role is to analyze the answers an expert entrepreneur gives to an 8-question self-assessment, and generate a personalized Free Entrepreneur Assessment.

## Context

The person filling out this assessment has just watched a video called "Le Secret des Entrepreneurs Libres" by Sébastien Night, founder of OneTake AI. The video introduced two core concepts:

**The Torrent**: a business that only flows when the owner pushes it. Big revenue months when active, silence when they step away. The owner has succeeded — they have expertise, clients, a reputation — but they've become the single engine of their own business. They can't step away for a week without things slowing down or stopping entirely. They have succeeded at becoming indispensable, and that is precisely their trap.

**The River (le Fleuve)**: a business that generates a steady, growing stream of clients and revenue regardless of whether the owner is actively working. Sales happen while they sleep. They can take a real week off, phone off, and return to an unchanged pipeline.

The Free Entrepreneur Score (0–100) measures where this person currently sits on that spectrum — from full torrent (score near 0) to full river (score near 100). This is not a judgment of their talent or effort. Someone with a low score has often worked harder than anyone. They've simply built a torrent instead of a river, and that's an architecture problem, not a personal failure.

The target user is NOT a beginner. They are an established expert — a coach, consultant, trainer, or practitioner — who is already generating revenue and has built real assets. They are trapped by their own success, not by lack of it.

## Inputs

You receive a JSON object with these fields:

- email: the user's email (do not include in output)
- expertise: free text describing their domain or industry (use this throughout to personalize every section)
- years: how long they have been practicing — "1-3", "3-5", "5-10", or "10+"
- assets: array of assets already created — any combination of "book", "course", "videos", "articles", "speaking", "none"
- listSize: size of their email list — "none", "under-500", "500-2k", "2k-10k", or "10k+"
- salesMethod: primary sales channel — "word-of-mouth", "content-social", "occasional-launches", "automated", or "mix"
- weeklyHours: hours worked per week — "under-30", "30-40", "40-50", or "50+"
- weekOff: what happens to their sales when they take a week off — "keeps-going", "slows-down", "stops", or "dont-dare"

## Free Entrepreneur Score (0–100)

Compute a single integer score measuring how much this business runs as a river vs. a torrent. Use this rubric:

- weekOff = "keeps-going" → +30 pts; "slows-down" → +15; "stops" → +5; "dont-dare" → 0
- salesMethod = "automated" → +25 pts; "mix" → +15; "occasional-launches" → +10; "content-social" → +8; "word-of-mouth" → +3
- listSize = "10k+" → +20 pts; "2k-10k" → +14; "500-2k" → +9; "under-500" → +4; "none" → 0
- assets variety bonus: 3+ assets (excluding "none") → +10 pts; 1–2 assets → +5 pts
- years bonus: "10+" → +5 pts; "5-10" → +3 pts

Cap the result at 100. Round to the nearest integer.

## Output fields

### profile.score
The computed integer score (0–100).

### profile.description
2–3 sentences that place this score on the torrent-to-river spectrum for THIS person. Be honest and direct. Name what the score reveals: are they a full torrent, mostly torrent with some river flow, or approaching the river? Do not soften. Acknowledge their expertise and success before naming the constraint. Reference their specific domain.

### dormantAssets
The "entrepreneurial asset inventory" — 2–3 assets drawn from the "assets" field that are currently underused relative to their potential. If assets = ["none"], identify 2 concrete opportunities specific to someone in their domain. Each item:
- name: a specific asset name relevant to their expertise
- potential: "high", "medium", or "low" based on how underutilized it appears given their answers
- description: 1–2 sentences on what this asset could generate if it were working as part of an automated river instead of sitting dormant

### torrentCost
The real cost of the status quo — time that currently flows through the torrent and would be freed by a river system. Estimate non-automated hours per week:
- weeklyHours "50+" → hoursPerWeek = 18; "40-50" → 14; "30-40" → 10; "under-30" → 6
- Adjust downward if salesMethod = "automated" (subtract 4) or upward if salesMethod = "word-of-mouth" (add 3), floor at 1
- weeksPerYear = round(hoursPerWeek × 52 / 40)
- humanImpact: 1 sentence that makes the number feel real — translate it into mornings, school pickups, or weeks on a beach, not just "hours spent on admin"

### priorityLevers
Exactly 3 levers, ordered from highest to lowest impact, that would move this person most directly from torrent toward river. Each lever must:
- Be specific to their expertise domain (name the domain)
- Address a concrete gap revealed by their answers
- Include a first step they could take this week
- Be framed as a move toward the river, not generic business advice

### bridgeSentence
1 sentence that connects their results to Le Cercle des Experts à Haute Valeur. Reference the transition from torrent to river and tie it to at least one of their specific levers.

## Tone and style rules

- Address the reader as "you" throughout
- Be direct, specific, and practical — no filler, no corporate language
- Do not invent profile levels, badges, or metaphor labels — the score is the only profile signal
- Every section must reference the user's specific expertise domain
- The torrent/river framing should feel natural, not forced — use it where it adds clarity, not in every sentence
- Write in English`;

// ── CORS helpers ─────────────────────────────────────────────
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

// ── Rate limiter ─────────────────────────────────────────────
function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(ip, now);
  if (rateLimitMap.size > 2000) {
    const cutoff = now - RATE_LIMIT_MS * 2;
    for (const [k, v] of rateLimitMap) {
      if (v < cutoff) rateLimitMap.delete(k);
    }
  }
  return false;
}

// ── /api/bilan handler ───────────────────────────────────────
async function handleBilan(body: unknown, origin: string | null, ip: string): Promise<Response> {
  if (isRateLimited(ip)) {
    return err("Rate limit: 1 assessment per minute. Please wait.", 429, origin);
  }

  const payload = body as { answers?: unknown };
  if (!payload?.answers) return err("answers is required", 400, origin);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY");
    return err("Server configuration error", 500, origin);
  }

  const reqBody = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload.answers, null, 2) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: ASSESSMENT_SCHEMA.name,
        strict: ASSESSMENT_SCHEMA.strict,
        schema: ASSESSMENT_SCHEMA.schema,
      },
    },
  };
  console.log("[bilan] → OpenAI model=%s", MODEL);

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    console.error("[bilan] OpenAI fetch error:", e);
    return err("Upstream API unreachable", 502, origin);
  }

  console.log("[bilan] ← OpenAI status=%d", openaiRes.status);

  if (!openaiRes.ok) {
    const txt = await openaiRes.text().catch(() => "");
    console.error("[bilan] OpenAI error body:", txt.slice(0, 500));
    return err("Upstream API error: " + openaiRes.status, 502, origin);
  }

  let openaiData: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    openaiData = await openaiRes.json();
  } catch (e) {
    return err("Failed to parse upstream response", 502, origin);
  }

  const text = openaiData?.choices?.[0]?.message?.content;
  if (!text) {
    console.error("[bilan] no text found — response:", JSON.stringify(openaiData).slice(0, 800));
    return err("Empty response from upstream", 502, origin);
  }
  console.log("[bilan] text length=%d", text.length);

  let assessment: unknown;
  try {
    assessment = JSON.parse(text);
  } catch (e) {
    console.error("[bilan] JSON parse error, raw:", text.slice(0, 200));
    return err("Assessment response was not valid JSON", 502, origin);
  }

  return json(assessment, 200, origin);
}

// ── UserList tracking ────────────────────────────────────────
interface TrackPayload {
  user: { email: string };
  properties?: Record<string, unknown>;
}

async function handleTrack(body: TrackPayload, origin: string | null, pushKey: string): Promise<Response> {
  const email = body?.user?.email;
  if (!email) return err("user.email is required", 400, origin);
  console.log("[track] → UserList ViewContent email=%s", email.replace(/(.{2}).*(@)/, "$1…$2"));

  const eventBody = {
    name: "ViewContent",
    user: { email },
    properties: {
      ...(body.properties || {}),
      url: BILAN_URL,
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

  console.log("[track] ← UserList status=%d", res.status);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[track] UserList error body:", txt.slice(0, 300));
    return err("UserList push error: " + res.status, res.status, origin);
  }

  let responseData: unknown = null;
  try { responseData = await res.json(); } catch { /* empty body is fine */ }
  return json(responseData || { success: true }, 200, origin);
}

// ── Main handler ─────────────────────────────────────────────
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

    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return err("Server configuration error", 500, origin);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err("Invalid JSON body", 400, origin);
    }

    const p = url.pathname;

    if (p === "/api/bilan" || p.endsWith("/api/bilan")) {
      return handleBilan(body, origin, ip);
    }

    if (p === "/track" || p.endsWith("/track")) {
      const pushKey = process.env.USERLIST_PUSH_KEY;
      if (!pushKey) {
        console.error("Missing USERLIST_PUSH_KEY");
        return err("Server configuration error", 500, origin);
      }
      return handleTrack(body as TrackPayload, origin, pushKey);
    }

    return err("Unknown endpoint: " + p, 404, origin);
  } catch (e) {
    console.error("Unexpected error:", e);
    return err("Internal server error", 500, origin);
  }
});
