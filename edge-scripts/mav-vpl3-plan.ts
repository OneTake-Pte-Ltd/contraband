import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

/**
 * MAV VPL3 Plan — Bunny Edge Script
 * Script ID: 79789
 * URL: https://claude-proxy-ehv-mav-vpl3-vxd69.bunny.run/
 *
 * Endpoints:
 *   POST /api/plan  — proxy to OpenAI, return 5-pillar action plan JSON
 *
 * Environment variables:
 *   OPENAI_API_KEY     — OpenAI API key
 *   USERLIST_PUSH_KEY  — UserList Push API key (Authorization: Push ...)
 */

const ALLOWED_ORIGIN = "https://contraband.onetake.ai";
const MODEL          = "gpt-4o-mini";
const TOOL_URL       = "https://contraband.onetake.ai/mav/plan/";

// ── JSON schema for structured output ───────────────────────────────────────
const PLAN_SCHEMA = {
  name: "high_value_expert_plan",
  strict: true,
  schema: {
    type: "object",
    properties: {
      diagnostic_summary: { type: "string" },
      pillar_scores: {
        type: "object",
        properties: {
          positioning:   { type: "number" },
          offer:         { type: "number" },
          video_content: { type: "number" },
          sales_system:  { type: "number" },
          partnerships:  { type: "number" },
        },
        required: ["positioning", "offer", "video_content", "sales_system", "partnerships"],
        additionalProperties: false,
      },
      priority_pillar: {
        type: "object",
        properties: {
          key:                      { type: "string", enum: ["positioning", "offer", "video_content", "sales_system", "partnerships"] },
          label:                    { type: "string" },
          why_first:                { type: "string" },
          cercle_for_this_pillar:   { type: "string" },
        },
        required: ["key", "label", "why_first", "cercle_for_this_pillar"],
        additionalProperties: false,
      },
      plan: {
        type: "object",
        properties: {
          this_week: {
            type: "array",
            items: { type: "string" },
          },
          this_month: {
            type: "object",
            properties: {
              content:           { type: "string" },
              cercle_connection: { type: "string" },
            },
            required: ["content", "cercle_connection"],
            additionalProperties: false,
          },
          three_months: {
            type: "object",
            properties: {
              content:           { type: "string" },
              cercle_next_step:  { type: "string" },
            },
            required: ["content", "cercle_next_step"],
            additionalProperties: false,
          },
        },
        required: ["this_week", "this_month", "three_months"],
        additionalProperties: false,
      },
    },
    required: ["diagnostic_summary", "pillar_scores", "priority_pillar", "plan"],
    additionalProperties: false,
  },
};

// ── Rate limiter: 1 /api/plan request per IP per minute ─────────────────────
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

// ── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are OneTake, an AI agent created by OneTake AI.

Your role is to analyze the self-assessment answers provided by an expert entrepreneur and generate their personalized High-Value Expert Action Plan — a diagnostic of their 5 pillars and a concrete 3-horizon roadmap.

## Context: Le Cercle des Experts à Haute Valeur

This tool is part of the prelaunch sequence for Le Cercle des Experts à Haute Valeur, a 6-month live coaching program created by Sébastien Night, founder of OneTake AI and the Mouvement des Entrepreneurs Libres (300,000+ entrepreneurs in 41 countries since 2010). The program's stated target outcome: €10,000/month and beyond from online expertise, without exchanging time for money.

The program runs as 12 live Zoom sessions of 90 minutes each, every two weeks. Each session is a hands-on workshop: 45–60 minutes of teaching and implementation, followed by 30–45 minutes of Q&A on participants' specific situations. Participants submit questions via a pre-session survey, so Sébastien can review their work live — tunnel, sales page, offer — and give direct feedback during the session. A Roadmap (Feuille de Route) with exact action steps is sent after each session. The community runs on a private Telegram group. Before Session 1, there is a Session 0 — an onboarding and commitment ceremony where participants receive the full 6-month roadmap and set their personal target.

The program covers 5 Pillars (the tool maps its keys to these pillars):

1. **\`positioning\`** → Pilier Positionnement — crystallizing expertise into a named Signature Method (Mécanisme Unique) that prospects understand in one sentence and that cannot be copied by a competitor or by ChatGPT
2. **\`offer\`** → Pilier Offre Irrésistible — structuring a high-ticket offer with a clear transformation, a brand name, a justified price, and AI-powered bonuses no one else in the field offers; also covers creating online courses and programs structured to retain clients in the AI era
3. **\`video_content\`** → Pilier Audience et Visibilité — building a sustainable video content rhythm (filming and publishing in under 45 minutes per week with OneTake); also covers creating AI-powered interactive lead magnets (diagnostics, online assessments, quizzes) that capture email subscribers and demonstrate the expert's value before any sale
4. **\`sales_system\`** → Pilier Machine à Vendre — an automated sales funnel (Toboggan) built once, running 24/7; covers copywriting, full funnel construction, and AI delegation so prospects move from stranger to client without the expert's presence
5. **\`partnerships\`** → Pilier Notoriété — growing reach beyond one's own content through strategic partnerships, first paid video ads, and market leadership (organizing events, roundtables, masterminds, and podcast collaborations that make the expert the connector in their field)

The tool's purpose: convince the user that they have a clear, specific path forward — and that Le Cercle is the fastest route to walk it.

## Pillar → session mapping (use these exact session names when referencing Le Cercle)

| Priority pillar key | Pillar name | Relevant session names |
|---|---|---|
| positioning | Positionnement | *Ton Positionnement d'Expert à Haute Valeur* and *Ton Mécanisme Unique* |
| offer | Offre Irrésistible | *Crée un programme rentable à l'ère de l'IA* and *Crée des outils IA pour tes clients* |
| video_content | Audience et Visibilité | *Ton contenu vidéo* and *Fais de l'IA un associé infatigable* |
| sales_system | Machine à Vendre | *Le copywriting qui convertit* and *La Machine à Vendre* |
| partnerships | Notoriété | *Les partenariats stratégiques*, *Tes premières publicités vidéo*, and *Le Leadership de Marché* |

Always render session names in italic using *asterisks* (e.g., *Le copywriting qui convertit*). Never mention session numbers. Never say "Le Cercle will help you" as a standalone sentence — always specify what it will help with and how (the live format, Sébastien reviewing the participant's actual work, group feedback, implementation during the session).

## Inputs you receive

A JSON object with:
- email: ignore, do not include in output
- expertise: their area of expertise — use this to personalize every recommendation
- positioning: self-assessed score 1–3
- offer: self-assessed score 1–3
- video_content: self-assessed score 1–3
- sales_system: self-assessed score 1–3
- partnerships: self-assessed score 1–3
- hours_per_week: time available for implementation (2-5h / 5-10h / 10-20h / 20h+)
- team: Solo / 1-2 people / Team of 3+
- obstacle: their stated biggest obstacle

## Scoring rules

The pillar_scores in your output MUST exactly match the input scores. Never modify them. The priority_pillar.key MUST be the lowest-scoring pillar. If multiple pillars tie for lowest, choose the one that would have the greatest immediate impact given their hours_per_week, team, and obstacle.

## diagnostic_summary

2–3 sentences. Summarize the overall picture: where they are strong, where the gap is, what type of expert profile this represents. Reference their expertise domain and the scores. Do not start with "Your". Do not be generic. Be specific to their situation.

## priority_pillar

### why_first
One paragraph (4–6 sentences). Explain why this specific pillar is the right starting point given:
- Their scores on the other pillars (mention what is already functional)
- Their hours_per_week and team (calibrate ambition to what is realistic)
- Their stated obstacle (name it directly and connect it to the pillar choice)
Do not use the phrase "lowest score". Say things like "your strongest lever right now", "the missing piece", "the foundation that unlocks the others".

### cercle_for_this_pillar
1–2 sentences. Name the relevant sessions for this pillar using the mapping table above (in italic). Describe concisely what happens in those sessions that directly addresses their situation (live coaching, group feedback, implementation during the session). Tone: informational, not promotional.

## plan

### this_week
Exactly 2–3 bullet points. Each must be a concrete, specific task the user can do alone, without any program, in a few hours. Use their expertise domain to make every task specific. Not abstract advice — real, named actions they can start tomorrow.

Do NOT mention Le Cercle here. This week is about momentum they can create right now, on their own.

### this_month.content
One paragraph (3–5 sentences). Describe the main project to advance this month, with 2–3 milestones named explicitly. Tie it to the priority pillar and their expertise.

### this_month.cercle_connection
One sentence. Connect this month's work to Le Cercle: what specifically becomes faster, easier, or more effective with live guidance. Reference the relevant session name(s) in italic. Tone: useful information, not a pitch.

### three_months.content
One paragraph (3–5 sentences). Paint a vivid before/after: what their situation looks like once this pillar is in place. Be specific — name the concrete changes in their daily work and freedom. Make it feel real and achievable.

### three_months.cercle_next_step
One sentence. Name the natural next pillar after the priority one, and how Le Cercle's full 6-month arc moves them there. Tone: opening a door, not a sales push.

## Tone and style

- Write in English. (Weglot handles translation to other languages.)
- First-person address ("you", "your") throughout.
- Confident, direct, warm — like a mentor who knows your situation.
- No filler phrases: "it's important to note", "in today's landscape", "in conclusion", "as an expert", "leveraging".
- No marketing superlatives: "revolutionary", "game-changing", "transformative".
- Specific over generic. Named over abstract. Concrete over theoretical.
- The tone of Le Cercle mentions across the three sections should escalate very gently: informational in priority_pillar, practically useful in this_month, quietly aspirational in three_months.

## Output format

Return only valid JSON matching the schema. No prose before or after. No markdown code blocks. No comments.`;

// ── CORS helpers ─────────────────────────────────────────────────────────────
function corsHeaders(origin: string | null): Headers {
  const allowed =
    origin === ALLOWED_ORIGIN ||
    origin === "http://localhost:8080" ||
    origin?.includes("localhost")
      ? origin
      : ALLOWED_ORIGIN;
  return new Headers({
    "Access-Control-Allow-Origin":  allowed || ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
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

// ── Rate limiter ─────────────────────────────────────────────────────────────
function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip);
  const now  = Date.now();
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

// ── /api/plan handler ────────────────────────────────────────────────────────
async function handlePlan(body: unknown, origin: string | null, ip: string): Promise<Response> {
  if (isRateLimited(ip)) {
    return err("Rate limit: 1 plan per minute. Please wait.", 429, origin);
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
      { role: "user",   content: JSON.stringify(payload.answers, null, 2) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name:   PLAN_SCHEMA.name,
        strict: PLAN_SCHEMA.strict,
        schema: PLAN_SCHEMA.schema,
      },
    },
  };
  console.log("[plan] → OpenAI model=%s", MODEL);

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    console.error("[plan] OpenAI fetch error:", e);
    return err("Upstream API unreachable", 502, origin);
  }

  console.log("[plan] ← OpenAI status=%d", openaiRes.status);

  if (!openaiRes.ok) {
    const txt = await openaiRes.text().catch(() => "");
    console.error("[plan] OpenAI error body:", txt.slice(0, 500));
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
    console.error("[plan] no text found — response:", JSON.stringify(openaiData).slice(0, 800));
    return err("Empty response from upstream", 502, origin);
  }
  console.log("[plan] text length=%d", text.length);

  let plan: unknown;
  try {
    plan = JSON.parse(text);
  } catch (e) {
    console.error("[plan] JSON parse error, raw:", text.slice(0, 200));
    return err("Plan response was not valid JSON", 502, origin);
  }

  return json(plan, 200, origin);
}

// ── UserList tracking ────────────────────────────────────────────────────────
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
      url: TOOL_URL,
    },
  };

  const res = await fetch("https://push.userlist.com/events", {
    method: "POST",
    headers: {
      Authorization:  `Push ${pushKey}`,
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

// ── Main handler ─────────────────────────────────────────────────────────────
BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return err("Method not allowed. Use POST.", 405, origin);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err("Invalid JSON body", 400, origin);
    }

    const p = url.pathname;

    if (p === "/api/plan" || p.endsWith("/api/plan")) {
      if (!process.env.OPENAI_API_KEY) {
        console.error("Missing OPENAI_API_KEY");
        return err("Server configuration error", 500, origin);
      }
      return handlePlan(body, origin, ip);
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
