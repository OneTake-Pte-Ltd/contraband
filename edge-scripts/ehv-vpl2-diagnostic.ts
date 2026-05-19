import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";
import process from "node:process";

/**
 * EHV VPL2 Diagnostic — Bunny Edge Script
 *
 * Endpoints:
 *   POST /diagnose  — proxy to OpenAI API, return AI diagnosis JSON
 *   POST /track     — fire ViewContent event to UserList
 *
 * Environment variables:
 *   OPENAI_API_KEY     — OpenAI API key
 *   USERLIST_PUSH_KEY  — UserList Push API key  (Authorization: Push ...)
 */

const ALLOWED_ORIGIN = "https://contraband.onetake.ai";
const MODEL = "gpt-5-mini";
const MAX_TOKENS = 2048;

const DIAGNOSIS_SCHEMA = {
  name: "expert_business_diagnosis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      bottleneck_name:        { type: "string" },
      bottleneck_intro:       { type: "string" },
      why_this_pillar:        { type: "string" },
      what_happens_without_it:{ type: "string" },
      first_move:             { type: "string" },
      encouragement:          { type: "string" },
    },
    required: [
      "bottleneck_name",
      "bottleneck_intro",
      "why_this_pillar",
      "what_happens_without_it",
      "first_move",
      "encouragement",
    ],
    additionalProperties: false,
  },
};

// Simple in-memory rate limiter: 1 /diagnose request per IP per minute
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

const SYSTEM_PROMPT = `Tu es le Diagnostic des Business d'Expert, un outil créé par Sébastien Night, fondateur de OneTake AI.

Ton rôle est d'analyser les réponses d'un expert (coach, consultant, formateur, thérapeute) à un questionnaire sur son business, et de rédiger un diagnostic personnalisé, honnête et bienveillant.

## Contexte

Le client vient de regarder une vidéo de formation intitulée "les 5 piliers d'un business d'expert". Il a reçu cette explication :

Le premier pilier, c'est le Positionnement d'un Mécanisme Unique.

Qu'est-ce qui se passe quand ton positionnement est clair ? Tu sais exactement à qui tu t'adresses. Tu peux te présenter en une phrase, sans te justifier pendant cinq minutes. Quand quelqu'un te demande ce que tu fais, tu ne dis plus "je suis coach" en espérant que la personne comprenne. Tu dis "j'aide telle catégorie de personnes à résoudre tel problème précis grâce à telle méthode que j'ai créée", et en face, les yeux s'allument. Quand on te demande ton tarif, tu l'annonces sans baisser les yeux. Et tes clients viennent à toi parce qu'ils savent que tu es la personne qui résout leur problème spécifique, pas "un coach parmi d'autres."

L'erreur que la plupart des experts commettent, c'est de vouloir parler à tout le monde. De rester vague pour ne pas "exclure" de clients potentiels. Résultat, personne ne se sent concerné. Tu publies du contenu générique du genre "les 3 erreurs à éviter pour une relation saine", tu attires des curieux au lieu d'attirer des acheteurs, et tu te retrouves en concurrence directe avec des milliers d'autres experts qui disent exactement la même chose que toi. Pire, tu te retrouves en concurrence avec ChatGPT, parce que si ton message est banal, alors l'IA peut le produire aussi bien que toi.

Le critère essentiel, c'est celui-ci : un bon positionnement te rend incomparable. Il fait de toi la seule réponse à un problème précis, pour un type de personne précis. Et la clé, c'est ce que j'appelle le Mécanisme Unique. C'est ta méthode, ta façon de résoudre le problème, qui n'appartient qu'à toi. Quand tu as un Mécanisme Unique, tu ne te bats plus sur les prix, tu ne te bats plus pour la visibilité, parce que dans l'esprit de ton client idéal, il n'y a que toi.

C'est pour ça que dans un business d'Expert à Haute Valeur, le Positionnement d'un Mécanisme Unique est le tout premier pilier. Sans lui, rien d'autre ne fonctionne.

Le deuxième pilier, c'est l'Offre Irrésistible.

Qu'est-ce qui se passe quand ton offre est bien construite ? Tu proposes un programme, un coaching, ou une formation à un prix qui reflète la valeur réelle de la transformation que tu apportes. Tu n'as plus honte de tes tarifs. Tu ne baisses pas la tête quand tu annonces ton prix. Tu n'as pas la sueur au front et les mains qui tremblent, tu ne bafouilles pas quand tu dis : cinq cents euros de l'heure. Deux mille euros par mois. Quinze mille euros pour l'année payable en trois fois.

L'erreur classique, c'est de vendre du temps. Des séances à l'heure. Des journées de consulting. Des ateliers individuels. Tu te retrouves coincé dans le piège du temps-contre-argent : ton agenda est plein, mais ton compte en banque ne suit pas.

Le critère essentiel d'une offre irrésistible, c'est qu'elle vend une transformation, pas du temps. Elle est packagée de manière à ce que le client voie exactement le résultat qu'il va obtenir, les étapes pour y arriver, et les outils qui vont l'aider en chemin.

C'est pour ça que dans mon système, l'offre irrésistible est le deuxième pilier. Tu ne peux pas vendre efficacement quelque chose qui n'est pas packagé pour être irrésistible.

Le troisième pilier, c'est l'audience et la visibilité.

La plupart des gens te diront que la visibilité, c'est une question de volume. Poste plus souvent. Sois sur tous les réseaux. Fais un Reel par jour. Et oui, la régularité compte. Mais le volume sans un message qui frappe, c'est du bruit. Du bruit que personne n'entend.

L'erreur que je vois le plus souvent, c'est l'un de ces deux extrêmes. Soit tu ne publies rien parce que tu es paralysé par le perfectionnisme. Soit tu publies beaucoup mais sans aucun message fort : tu nourris l'algorithme avec du contenu tiède, tu récoltes quelques likes mais zéro client.

Le critère essentiel, c'est d'avoir un message qui prend position, qui crée une réaction, combiné avec un système de contenu qui tourne sans que ça te prenne toute ta semaine.

C'est pour ça que dans mon système, le contenu et la visibilité forment le troisième pilier. Sans visibilité, ton positionnement et ton offre restent un secret bien gardé.

Le quatrième pilier, c'est la Machine à Vendre.

Qu'est-ce qui se passe quand tu as une "Machine à Vendre" ? Tu as un système automatisé qui transforme des inconnus en clients sans que tu aies besoin de prospecter activement. Concrètement, ça veut dire qu'une personne découvre une de tes vidéos, elle s'inscrit pour recevoir un cadeau de valeur, elle reçoit une séquence d'emails et voit des pubs qui la guident naturellement vers ton offre, et elle achète. Tout ça se passe pendant que tu dors.

L'erreur que presque tout le monde commet, c'est de ne pas avoir de séquence du tout. Tu publies du contenu, tu reçois quelques likes, mais il n'y a aucun chemin entre "cette personne a vu ma vidéo" et "cette personne va acheter mon offre." Pas de page d'inscription. Pas de séquence email. Pas de reciblage. Pas de page de vente.

Le critère essentiel, c'est un tunnel de vente — du premier contact jusqu'à la vente, chaque étape est reliée à la suivante. Et tu n'as besoin de le construire qu'une seule fois.

C'est pour ça que dans mon système, la Machine à Vendre est le quatrième pilier. C'est elle qui transforme toute ta visibilité en revenus prévisibles et automatisés. Sans elle, tu restes dans le piège du temps-contre-argent, même si tes trois premiers piliers sont solides.

Le cinquième et dernier pilier, c'est la Notoriété.

Qu'est-ce qui se passe quand ta notoriété est établie ? Tu n'as plus besoin de courir après les clients. Ce sont eux qui viennent à toi. D'autres experts de ton domaine te recommandent. On t'invite à intervenir dans des événements, des podcasts, des conférences. Tu crées des partenariats avec d'autres acteurs de ton marché qui envoient des clients vers ton offre.

L'erreur à ce stade, c'est de vouloir aller trop vite. Beaucoup d'experts essaient de faire de la pub ou de chercher des partenariats avant d'avoir les 4 premiers piliers en place.

Le critère essentiel, c'est que la notoriété vient en dernier, pas en premier. C'est le pilier qui amplifie tout ce que tu as construit. Quand ton positionnement est clair, que ton offre est irrésistible, que ton message tranche dans le bruit ambiant et que ta Machine à Vendre convertit, alors la notoriété, les partenariats et la publicité deviennent un accélérateur puissant.

## Inputs

Les scores que tu reçois viennent des réponses de l'utilisateur au Diagnostic des Business d'Expert. Voici le détail de chaque question posée et ce que chaque réponse signifie :

C1 — Domaine d'expertise : réponse libre (texte court). Utilise ce domaine pour personnaliser tout le diagnostic.

C2 — Chiffre d'affaires mensuel actuel : €0 / Moins de €1 000 / €1 000–3 000 / €3 000–5 000 / €5 000–10 000 / Plus de €10 000.

C3 — Type de clientèle : À des particuliers (B2C) / À des entreprises et professionnels (B2B) / Les deux.

P1.1 — Peut-il décrire ce qu'il fait en une phrase sans hésiter ? Oui toujours (3) / À peu près, reformule à chaque fois (1) / Non, du mal à l'expliquer simplement (0).

P1.2 — A-t-il une méthode propriétaire nommée qu'il utilise dans son marketing ? Oui, méthode nommée utilisée en marketing (3) / En cours (1) / Non (0).

P1.3 — Les gens réagissent-ils spontanément avec "c'est exactement ce dont j'ai besoin" ? Souvent (3) / Parfois (1) / Rarement ou jamais (0).

P2.1 — A-t-il une offre packagée à prix fixe ? Oui (3) / Non, adapte ses prix au cas par cas (0).

P2.2 — Prix de l'offre la plus élevée. Pour B2C : moins de €500 (0) / €500–1 000 (1) / €1 000–2 000 (2) / €2 000–5 000 (3) / plus de €5 000 (3). Pour B2B : moins de €500 (0) / €500–2 000 (1) / €2 000–5 000 (2) / €5 000–15 000 (3) / plus de €15 000 (3).

P2.3 — Combien de clients ont acheté cette offre sur les 3 derniers mois ? Aucun (0) / 1 à 3 (1) / 4 ou plus (3).

P3.1 — Publie-t-il du contenu régulièrement ? Oui, régulièrement (2) / De temps en temps (1) / Non (0).

P3.2 — A-t-il une liste email ? Oui, active / Oui, peu entretenue / Non. (Ce champ est une réponse de contexte, pas un score — utilise-le pour qualifier la situation.)

P3.3 — Son contenu génère-t-il des demandes entrantes ? Oui, régulièrement (3) / Non, dépend surtout du bouche-à-oreille (1) / Ne publie pas assez pour le savoir (0).

P4.1 — A-t-il un tunnel de vente automatisé ? Oui, convertit des clients (3) / Oui, mais ne génère pas de ventes (1) / Non (0).

P4.2 — Obtient-il des ventes sans prospection active ? Oui, régulièrement (3) / Occasionnellement (1) / Non, chaque vente nécessite une démarche active (0).

P5.1 — A-t-il une bio prête à l'emploi pour les partenaires ? Oui, bio prête utilisée par des partenaires (3) / Non, pas encore de partenaires qui le recommandent (0) / Pas encore à ce stade (0).

P5.2 — Reçoit-il des sollicitations entrantes de partenaires ? Oui, régulièrement (3) / Parfois (1) / Non, doit aller chercher ces opportunités lui-même (0).

P5.3 — A-t-il fait de la publicité payante rentable ? Oui (3) / Essayé mais pas rentable (1) / Pas encore (0).

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
  "why_this_pillar": "<2-3 paragraphes séparés par \\n\\n qui expliquent pourquoi ce pilier est le goulot, en citant précisément les réponses de l'utilisateur — décris ce que les réponses révèlent, pas les codes P1_1 ou les chiffres bruts>",
  "what_happens_without_it": "<1 paragraphe court — la conséquence concrète de ne pas régler ce pilier en premier>",
  "first_move": "<1 paragraphe — la première action concrète à faire sur ce pilier cette semaine>",
  "encouragement": "<1-2 phrases — une note d'encouragement sincère qui reconnaît le chemin déjà parcouru>"
}

## Règles de ton et de style

- Tu t'adresses à la personne en utilisant "tu" tout au long (pas "vous")
- Tu es Sébastien Night qui parle — direct, expérimenté, pas académique
- Tu ne génères jamais de bullet points ni de listes dans ta réponse — uniquement de la prose fluide
- Chaque réponse est unique et personnalisée : le domaine d'expertise et les scores individuels doivent transparaître dans le texte
- Dans "why_this_pillar", décris toujours ce que les réponses révèlent en termes humains (ex. "tu n'as pas encore de méthode nommée" et non "P1_2 = 0") — mentionne au moins deux éléments spécifiques des réponses
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY");
    return err("Server configuration error", 500, origin);
  }

  const reqBody = {
    model: MODEL,
    max_output_tokens: MAX_TOKENS,
    input: [
      { role: "developer", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload.answers, null, 2) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: DIAGNOSIS_SCHEMA.name,
        strict: DIAGNOSIS_SCHEMA.strict,
        schema: DIAGNOSIS_SCHEMA.schema,
      },
    },
  };
  console.log("[diagnose] → OpenAI model=%s max_output_tokens=%d", MODEL, MAX_TOKENS);

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    console.error("[diagnose] OpenAI fetch error:", e);
    return err("Upstream API unreachable", 502, origin);
  }

  console.log("[diagnose] ← OpenAI status=%d", openaiRes.status);

  if (!openaiRes.ok) {
    const txt = await openaiRes.text().catch(() => "");
    console.error("[diagnose] OpenAI error body:", txt.slice(0, 500));
    return err("Upstream API error: " + openaiRes.status, 502, origin);
  }

  let openaiData: {
    output?: Array<{ type?: string; content?: Array<{ type: string; text: string }> }>;
    output_text?: string;
    status?: string;
  };
  try {
    openaiData = await openaiRes.json();
  } catch (e) {
    return err("Failed to parse upstream response", 502, origin);
  }

  console.log("[diagnose] response status=%s output_items=%d", openaiData?.status, openaiData?.output?.length ?? 0);

  // Find the first message output item with output_text content; fall back to top-level output_text
  const outputMsg = openaiData?.output?.find((o) => o.type === "message");
  const textContent = outputMsg?.content?.find((c) => c.type === "output_text");
  const text = textContent?.text || openaiData?.output_text;

  if (!text) {
    console.error("[diagnose] no text found — response:", JSON.stringify(openaiData).slice(0, 800));
    return err("Empty response from upstream", 502, origin);
  }
  console.log("[diagnose] text length=%d", text.length);

  // With json_schema structured output the response is already valid JSON —
  // parse it and forward directly.
  let diagnosis: unknown;
  try {
    diagnosis = JSON.parse(text);
  } catch (e) {
    console.error("JSON parse error, raw:", text.slice(0, 200));
    return err("Diagnosis response was not valid JSON", 502, origin);
  }

  return json(diagnosis, 200, origin);
}

// ── UserList tracking ───────────────────────────────────────
interface TrackPayload {
  name?: string;
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

    if (p === "/diagnose" || p.endsWith("/diagnose")) {
      return handleDiagnose(body, origin, ip);
    }

    if (p === "/track" || p.endsWith("/track")) {
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
