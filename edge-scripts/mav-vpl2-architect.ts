import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

/**
 * MAV VPL2 Architect — Bunny Edge Script
 * Script ID: 79366
 * URL: https://proxy-ehv-mav-vpl2-architect-4eoze.bunny.run/
 *
 * Endpoints:
 *   POST /api/architect  — proxy to OpenAI, return Waterslide flowchart JSON
 *   POST /track          — fire ViewContent event to UserList
 *
 * Environment variables:
 *   OPENAI_API_KEY     — OpenAI API key
 *   USERLIST_PUSH_KEY  — UserList Push API key  (Authorization: Push ...)
 */

const ALLOWED_ORIGIN = "https://contraband.onetake.ai";
const MODEL          = "gpt-4o-mini";
const ARCHITECT_URL  = "https://contraband.onetake.ai/mav/architect/";

// ── JSON schema for structured output ───────────────────────────────────────
const WATERSLIDE_SCHEMA = {
  name: "visual_waterslide",
  strict: true,
  schema: {
    type: "object",
    properties: {
      toboggan: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id:                  { type: "number" },
                name:                { type: "string" },
                type:                { type: "string" },
                status:              { type: "string", enum: ["in_place", "to_create"] },
                description:         { type: "string" },
                selling_points:      { type: "array", items: { type: "string" } },
                objection_responses: { type: "array", items: { type: "string" } },
                connection_label:    { type: "string" },
              },
              required: [
                "id", "name", "type", "status", "description",
                "selling_points", "objection_responses", "connection_label",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["steps"],
        additionalProperties: false,
      },
      weakest_link: {
        type: "object",
        properties: {
          step_id:               { type: "number" },
          analysis:              { type: "string" },
          suggested_lead_magnet: { type: "string" },
        },
        required: ["step_id", "analysis", "suggested_lead_magnet"],
        additionalProperties: false,
      },
    },
    required: ["toboggan", "weakest_link"],
    additionalProperties: false,
  },
};

// ── Rate limiter: 1 /api/architect request per IP per minute ────────────────
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

// ── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are OneTake, an AI agent created by OneTake AI.

Your role is to analyze the business information provided by an expert entrepreneur and generate their personalized "Waterslide" — a visual map of the complete journey from stranger to paying client, named specifically for their business.

## The Waterslide metaphor

A Waterslide is a sales slide. Once a prospect arrives at the top (usually a free resource), they glide naturally downward through each step, building trust and conviction along the way, until they reach the bottom: the moment they become a client. Your job is to design this slide — 5 to 7 steps — using the expert's specific content, offer, and audience.

**Terminology by language:** In English output (en), call it "Waterslide". In French output (fr), call it "Toboggan". In Spanish (es): "Tobogán". In Portuguese (pt-BR): "Tobogã". In Italian (it): "Toboggan". In Japanese (ja): "ウォータースライド". Apply the correct term consistently across all text fields in the output.

## What the Waterslide must communicate

Every well-designed Waterslide guides the prospect through six communication objectives, in this order. When generating steps, verify that your sequence collectively covers all six:

1. **Opportunity** — There is a real, concrete opportunity to improve their situation. The prospect feels this before anything else is said.
2. **Credibility** — Who the expert is, why they are specifically qualified to deliver this result, and what gives them the right to make this promise.
3. **Relevance** — Why the prospect should pay attention right now, and what they personally and specifically stand to gain.
4. **Social proof** — Who else has trusted this expert, and what concrete, specific results they achieved (names, numbers, timeframes, before/after).
5. **Offer** — What exactly is being proposed, what it includes, and how to take action on it.
6. **Risk reduction** — What makes this offer safe to say yes to: guarantee, track record, easy onboarding, limited risk.

If your generated steps do not naturally cover one of these six objectives — for example, there is no step dedicated to social proof or credibility — note this explicitly as a gap in the weakest_link analysis.

## Your prospect's state of mind

The experts who use this tool serve sophisticated, experienced buyers — coaches, consultants, and entrepreneurs who have already invested hundreds or thousands in programs that failed to deliver. This "mature buyer" profile shapes how every step must be designed:

- They are skeptical of polished marketing language. They have seen it before.
- They are not moved by generic testimonials. They want specific, verifiable outcomes: real client names, real numbers, real timeframes.
- They have been disappointed by previous purchases. Every promise triggers resistance.
- They are time-pressured. A slow or generic sequence will lose them immediately.

Design each step — especially nurture and conversion steps — to earn trust through specificity and substance, not volume of persuasion. One concrete case study with named results is worth ten bullet points of features.

## Inputs you receive

A JSON object with:
- language: the language to write the output in (en, fr, es, pt-BR, it, ja)
- email: the user's email — ignore this, do not include in output
- expertise: their area of expertise — use this to personalize every step name
- idealClient: who their ideal client is
- coreProblem: the main problem they solve
- mainOffer: their flagship offer and its approximate price
- sellingPoints: the key arguments that convince prospects to buy
- objections: the typical objections prospects raise
- existingContent: array of content types already produced (videos, articles, podcast, book, social, none)
- hasLeadMagnet: "yes" or "no"
- leadMagnetDesc: description of their lead magnet (present only if hasLeadMagnet is "yes")

## How to build the Waterslide steps

Generate exactly 5 to 7 steps. Each step flows to the next, from top of funnel (stranger) to bottom (paying client).

### Step naming — this is the most important rule

NEVER use generic labels. Every step name must be specific to this person's business and domain. The name should read like a real product, a real piece of content, or a real sales moment — not a category label.

Forbidden generic names (do NOT use these):
"Lead Magnet", "Email Sequence", "Email Nurture", "Webinar", "Sales Page", "Main Offer", "Discovery Call", "Content", "Social Media", "Upsell", "Ascension", "Trust Builder", "Nurture"

Required style — specific, named, real:
- Instead of "Lead Magnet" → "Free guide: '5 signs your expertise is keeping you trapped'"
- Instead of "Email Sequence" → "5-day email series: 'The dog owner's guide to calm walks'"
- Instead of "Webinar" → "Free live training: 'How I built a €200K coaching practice without selling my time'"
- Instead of "Main Offer" → "12-week group program 'The Confident Expert' (€3,000)"
- Instead of "Ascension" → "Annual alumni membership: ongoing masterclasses + private community"
- Instead of "Trust Builder" → "3-email sequence: results from 12 years of client transformations"

Use the exact mainOffer text and price when naming the main offer step.

### Step types

Use one of the following values for the \`type\` field:

- \`discovery\` — how cold strangers first encounter the expert (social posts, YouTube, podcast, book, PR, referrals)
- \`lead_magnet\` — a free resource that captures the prospect's email address (guide, quiz, checklist, mini-course, tool)
- \`trust_builder\` — a dedicated step whose primary purpose is credibility and social proof: named client case studies, before/after results, media features, published outcomes, testimonial sequences. Use this when the mature-buyer audience needs to see hard evidence before any sales conversation can begin.
- \`email_sequence\` — an automated email series that educates, handles objections, and moves toward a sale
- \`webinar\` — a live or automated training session that delivers genuine value and ends with an offer
- \`sales_page\` — a long-form written or video page presenting the full offer
- \`discovery_call\` — a 1:1 qualifying conversation
- \`main_offer\` — the expert's flagship product or service
- \`ascension\` — post-purchase retention, community, or higher-ticket upsell

### Status rules

Set status to "in_place" if the step corresponds to something the expert demonstrably already has:
- Their mainOffer exists and they are selling it → the corresponding step is "in_place"
- hasLeadMagnet = "yes" → the lead magnet step is "in_place" (use leadMagnetDesc to name it specifically)
- existingContent includes "videos" → a video-based discovery step can be "in_place"
- existingContent includes "podcast" → a podcast discovery step can be "in_place"
- existingContent includes "articles" → a blog/article step can be "in_place"
- existingContent includes "book" → a book-based authority or trust_builder step can be "in_place"
- existingContent is ["none"] → nothing beyond the main offer is "in_place"

Set status to "to_create" for all other steps.

### Selling points and objections

Distribute sellingPoints and objections across the relevant steps where they would naturally be deployed — do not pile them all into one step. Email sequences and discovery calls are natural places for objection responses. Webinars and sales pages are natural places for selling points. Use each argument at most once, and only where it is contextually relevant.

For selling_points and objection_responses in each step: include only the arguments that are genuinely relevant to that step. Most steps will have 0 to 2 items per field. Use empty arrays [] when none apply.

### Connection labels

connection_label describes what moves the prospect from this step to the next one. Be brief and specific: "Email opt-in form", "Automated 5-email sequence", "Live training invitation", "Registration page", "Checkout page". Use empty string "" for the last step (no connection needed after the final step) and for any transition that has no meaningful label.

### Typical 5-step Waterslide structure (adapt to the user's situation)

1. **Discovery** — how cold strangers first encounter the expert (organic content, social posts, YouTube, podcast, book, etc.)
2. **Lead magnet** — a free resource that captures the prospect's email and delivers immediate value
3. **Trust builder** — a dedicated sequence that leads with social proof: specific client results, case studies, credibility signals. Positioned before any sales moment because the mature buyer must see hard evidence first.
4. **Conversion** — the moment the sale happens (webinar, discovery call, video sales letter, live event)
5. **Main offer** — the flagship product or service (use the exact mainOffer text and price)

Add a 6th or 7th step when:
- There is a clear retention/ascension play (alumni community, membership, higher-ticket offer)
- There is a natural separation between two discovery layers (e.g., social media posts → YouTube channel → lead magnet)

## Weakest link

Identify the single step that is most critical to build first — the missing piece that, if added, would have the greatest immediate impact on the number of clients.

Diagnose the gap through these three lenses:
1. **Information gap** — Does the prospect have the information they need — the opportunity framing, the credibility proof, the offer details — to make a confident buying decision?
2. **Trust gap (Facteurs Créateurs de Confiance)** — Are the trust-building factors sufficient? Does the sequence include specific social proof, real client results, and credibility signals? A missing trust_builder step is almost always the highest-impact gap when serving an experienced, skeptical buyer.
3. **Conversion gap** — Is there a clear, irresistible moment where the sale happens, with a specific reason to act now rather than later?

The weakest link is almost always one of:
- A missing lead magnet when the expert has no way to capture emails
- A missing trust_builder step when prospects discover the expert but don't convert (most common in mature-buyer markets)
- A missing conversion mechanism when there is no clear moment the sale happens

In analysis: be specific and direct. Name the concrete consequence of this gap for their particular situation. Reference their expertise, their existing content, and their offer. 3 to 5 sentences.

In suggested_lead_magnet: propose a concrete, domain-specific asset tailored to their expertise and ideal client — this can be a lead magnet if the top of funnel is missing, or a trust-building asset (case study sequence, results document, proof-of-concept video) if the trust gap is the priority. Give it a real working title. Explain in 2–3 sentences why this specific format and topic would resonate with their ideal client and fit naturally into the identified gap.

## Language

Write ALL output text in the language specified in the "language" field:
- en  → English
- fr  → French
- es  → Spanish
- pt-BR → Brazilian Portuguese
- it  → Italian
- ja  → Japanese

This applies to every field: step names, descriptions, selling_points, objection_responses, connection_label, analysis, suggested_lead_magnet.

## Output format

Return only valid JSON matching the schema. No prose before or after the JSON. No markdown code blocks. No comments.`;

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

// ── /api/architect handler ───────────────────────────────────────────────────
async function handleArchitect(body: unknown, origin: string | null, ip: string): Promise<Response> {
  if (isRateLimited(ip)) {
    return err("Rate limit: 1 Waterslide per minute. Please wait.", 429, origin);
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
        name:   WATERSLIDE_SCHEMA.name,
        strict: WATERSLIDE_SCHEMA.strict,
        schema: WATERSLIDE_SCHEMA.schema,
      },
    },
  };
  console.log("[architect] → OpenAI model=%s", MODEL);

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
    console.error("[architect] OpenAI fetch error:", e);
    return err("Upstream API unreachable", 502, origin);
  }

  console.log("[architect] ← OpenAI status=%d", openaiRes.status);

  if (!openaiRes.ok) {
    const txt = await openaiRes.text().catch(() => "");
    console.error("[architect] OpenAI error body:", txt.slice(0, 500));
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
    console.error("[architect] no text found — response:", JSON.stringify(openaiData).slice(0, 800));
    return err("Empty response from upstream", 502, origin);
  }
  console.log("[architect] text length=%d", text.length);

  let toboggan: unknown;
  try {
    toboggan = JSON.parse(text);
  } catch (e) {
    console.error("[architect] JSON parse error, raw:", text.slice(0, 200));
    return err("Waterslide response was not valid JSON", 502, origin);
  }

  return json(toboggan, 200, origin);
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
      url: ARCHITECT_URL,
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

    if (p === "/api/architect" || p.endsWith("/api/architect")) {
      return handleArchitect(body, origin, ip);
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
