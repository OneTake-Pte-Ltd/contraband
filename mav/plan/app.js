(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  var WEBHOOK_URL = 'https://onetake.app.n8n.cloud/webhook/plan-vpl3';
  var PROXY_URL   = 'https://claude-proxy-ehv-mav-vpl3-vxd69.bunny.run/api/plan';
  var CTA_URL     = 'https://try.onetake.ai/bootcamps/mav/vpl3-clone/#comments';
  var TOTAL_STEPS = 9;

  /*
   * Proxy system prompt guidance (implemented server-side):
   * 1. Return valid JSON matching the plan schema (no prose outside JSON)
   * 2. Personalize every paragraph to the user's area of expertise and stated obstacle
   * 3. The priority_pillar must match the lowest-scoring pillar (or the AI's
   *    choice if multiple tie) — pillar_scores values are passed in by the client
   *    and must not be modified by the AI
   * 4. Session names in cercle_for_this_pillar and cercle_connection must always
   *    be in italic Markdown (*Name*) — the frontend strips Markdown into <em> tags
   * 5. Never use generic filler — every action in this_week must be specific to
   *    the user's domain, not abstract advice
   * 6. Respond in English (Weglot handles translation)
   *
   * Pillar → session mapping (for cercle references):
   *   positioning  → *Ton Positionnement d'Expert à Haute Valeur* and *Ton Mécanisme Unique*
   *   offer        → *Crée un programme rentable à l'ère de l'IA* and *Crée des outils IA pour tes clients*
   *   video_content → *Ton contenu vidéo* and *Fais de l'IA un associé infatigable*
   *   sales_system  → *Le copywriting qui convertit* and *La Machine à Vendre*
   *   partnerships  → *Les partenariats stratégiques* and *Tes premières publicités vidéo*
   *
   * Expected JSON schema:
   * {
   *   "diagnostic_summary": "string",
   *   "pillar_scores": {
   *     "positioning": 1|2|3,
   *     "offer": 1|2|3,
   *     "video_content": 1|2|3,
   *     "sales_system": 1|2|3,
   *     "partnerships": 1|2|3
   *   },
   *   "priority_pillar": {
   *     "key": "positioning|offer|video_content|sales_system|partnerships",
   *     "label": "string",
   *     "why_first": "string",
   *     "cercle_for_this_pillar": "string"
   *   },
   *   "plan": {
   *     "this_week": ["string", "string", "string"],
   *     "this_month": {
   *       "content": "string",
   *       "cercle_connection": "string"
   *     },
   *     "three_months": {
   *       "content": "string",
   *       "cercle_next_step": "string"
   *     }
   *   }
   * }
   */

  // ── State ───────────────────────────────────────────────────────────────────
  var currentStep  = 0;
  var lastPayload  = null;

  var answers = {
    email:          '',
    expertise:      '',
    positioning:    0,
    offer:          0,
    video_content:  0,
    sales_system:   0,
    partnerships:   0,
    hours_per_week: '',
    team:           '',
    obstacle:       ''
  };

  // ── Mock response (used when PROXY_URL contains "placeholder") ──────────────
  var MOCK_RESPONSE = {
    diagnostic_summary: "You have a clear area of expertise and a defined offer, but your automated sales system and partnerships are the two blind spots holding you back. This is the classic profile of a recognized expert who is credible and visible — but whose growth is capped by the absence of a system that works without them.",
    pillar_scores: {
      positioning:   2,
      offer:         2,
      video_content: 1,
      sales_system:  1,
      partnerships:  1
    },
    priority_pillar: {
      key:   "sales_system",
      label: "Automated sales system",
      why_first: "You work solo with limited hours to invest each week. Your positioning is already functional — the most immediate lever is building the one automated sequence that moves prospects from 'interested' to 'paid' without requiring your personal attention each time. Without it, every new client still demands a one-to-one conversation, and your time is your scarcest resource. Getting one working funnel in place — even a simple one — changes the structure of your week permanently.",
      cercle_for_this_pillar: "In Le Cercle, the *Le copywriting qui convertit* and *La Machine à Vendre* sessions are designed for exactly this: you arrive with your existing content and offer, and leave each session with a working funnel segment — written, reviewed, and stress-tested with the group in real time."
    },
    plan: {
      this_week: [
        "Write the 3-sentence version of your core transformation: who you help, what they struggle with, and what their situation looks like after working with you.",
        "Sketch your client journey on paper: what happens between 'first contact' and 'first payment'? Map it in 5 steps, no tools needed.",
        "Identify the one piece of content you already have — a talk, an article, an email — that best explains why your approach works. This becomes your first funnel anchor."
      ],
      this_month: {
        content: "Build your first automated sales sequence end to end. Milestone 1: create and publish a lead magnet (a focused resource your ideal client would read the same day). Milestone 2: write a 5-email sequence that educates, handles the main objection, and closes with a clear invitation to your offer. Milestone 3: confirm your first automated sale — someone who bought without you being personally present in the conversation.",
        cercle_connection: "This is precisely the work covered in the *Le copywriting qui convertit* session — doing it live with Sébastien reviewing your copy compresses months of solo testing into a single session."
      },
      three_months: {
        content: "In 90 days, your funnel is running. New prospects enter weekly via your lead magnet. Your email sequence qualifies them automatically. You open your laptop on Monday morning and see purchases from the weekend — without having sent a single manual message. Your active selling time drops from 8–10 hours a week to under 2. The torrent has become a river.",
        cercle_next_step: "Once your sales system is in place, Le Cercle moves you into partnerships and paid visibility — the two pillars that multiply what you've already built and turn a working funnel into a predictable, scalable growth engine."
      }
    }
  };

  // ── URL param: pre-fill email ───────────────────────────────────────────────
  var urlParams  = new URLSearchParams(window.location.search);
  var emailParam = urlParams.get('email');
  if (emailParam) answers.email = decodeURIComponent(emailParam);

  // ── Pillar metadata ─────────────────────────────────────────────────────────
  var PILLARS = [
    { key: 'positioning',   label: 'Positioning' },
    { key: 'offer',         label: 'Offer' },
    { key: 'video_content', label: 'Video content' },
    { key: 'sales_system',  label: 'Sales system' },
    { key: 'partnerships',  label: 'Partnerships' }
  ];

  // Steps 3–7 map to pillar index 0–4
  var PILLAR_QUESTIONS = [
    {
      title:    'Your positioning and signature method',
      opts: [
        { value: '1', label: 'When someone asks me what I do, I explain for 3 minutes and they still don\'t really get it.' },
        { value: '2', label: 'I can explain what I do, but I don\'t clearly stand out from others in my field.' },
        { value: '3', label: 'People understand in one sentence what I do and why it\'s different from anything else out there.' }
      ]
    },
    {
      title:    'Your structured, priced offer',
      opts: [
        { value: '1', label: 'I do custom work every time — pricing case by case, no clear structure, and I often struggle to justify my rates.' },
        { value: '2', label: 'I have a defined offer with a price, but prospects often hesitate or compare me with cheaper alternatives.' },
        { value: '3', label: 'My offer is clear, my rates are firm, and clients understand why it\'s worth the price.' }
      ]
    },
    {
      title:    'Your video content',
      opts: [
        { value: '1', label: 'I don\'t publish video, or only very rarely — when I have time, which is basically never.' },
        { value: '2', label: 'I publish from time to time, but it\'s inconsistent and I\'m not sure it actually brings in clients.' },
        { value: '3', label: 'I have a regular publishing rhythm and I can see that my content attracts qualified prospects.' }
      ]
    },
    {
      title:    'Your automated sales system',
      opts: [
        { value: '1', label: 'My sales depend entirely on me: if I\'m not prospecting, following up, or posting, nothing comes in.' },
        { value: '2', label: 'I have bits and pieces of a system (a sales page, some emails), but nothing that runs end-to-end on its own.' },
        { value: '3', label: 'I have a funnel in place: people discover me, receive my content, and some buy without me lifting a finger.' }
      ]
    },
    {
      title:    'Your partnerships and paid visibility',
      opts: [
        { value: '1', label: 'I rely solely on my own content and word of mouth to get known.' },
        { value: '2', label: 'I\'ve done a few collaborations or tested some ads, but nothing regular or structured.' },
        { value: '3', label: 'I have active partnerships or ad campaigns that bring in new prospects on a regular basis.' }
      ]
    }
  ];

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    render(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function render(step, direction) {
    direction = direction || 'forward';
    currentStep = step;

    var app = document.getElementById('app');
    var cls = direction === 'forward' ? 'step-enter' : 'step-enter-back';

    if (step === 0) {
      app.innerHTML = renderHero();
    } else if (step === 10) {
      app.innerHTML = renderLoading();
      startLoading();
    } else if (step === 'error') {
      app.innerHTML = renderError();
    } else {
      app.innerHTML = renderProgressBar(step) + renderStep(step);
    }

    var inner = app.querySelector('.step-inner, .hero-inner, .loading-inner, .error-inner');
    if (inner) inner.classList.add(cls);

    bindStep(step);
  }

  // ── Progress bar ────────────────────────────────────────────────────────────
  function renderProgressBar(step) {
    var pct = ((step - 1) / TOTAL_STEPS) * 100;
    return '<div class="progress-wrap" role="progressbar" aria-valuenow="' + step +
      '" aria-valuemin="1" aria-valuemax="' + TOTAL_STEPS + '" aria-label="Step ' + step + ' of ' + TOTAL_STEPS + '">' +
      '<div class="progress-fill" style="width:' + pct + '%"></div>' +
    '</div>';
  }

  // ── Hero ────────────────────────────────────────────────────────────────────
  function renderHero() {
    return '<div class="hero-shell">' +
      '<div class="hero-inner">' +
        '<div class="hero-eyebrow">OneTake AI · High-Value Expert Action Plan</div>' +
        '<h1 class="hero-title">Your personalized action plan, based on your situation.</h1>' +
        '<div class="hero-deco"></div>' +
        '<p class="hero-sub">Answer 10 questions about where you stand today. OneTake evaluates your 5 Expert Pillars, identifies your highest-leverage starting point, and generates a concrete 3-horizon plan — what to do this week, this month, and in 3 months.</p>' +
        '<button class="btn-primary" id="hero-cta" style="font-size:15px;padding:18px 40px;">Start my diagnostic →</button>' +
      '</div>' +
    '</div>';
  }

  // ── Steps shell ─────────────────────────────────────────────────────────────
  function renderStep(step) {
    var html = '<div class="step-shell"><div class="step-inner">';
    html += '<div class="step-label">Step ' + step + ' / ' + TOTAL_STEPS + '</div>';

    switch (step) {
      case 1: html += renderEmailStep();             break;
      case 2: html += renderExpertiseStep();         break;
      case 3: html += renderSinglePillarStep(0);     break;
      case 4: html += renderSinglePillarStep(1);     break;
      case 5: html += renderSinglePillarStep(2);     break;
      case 6: html += renderSinglePillarStep(3);     break;
      case 7: html += renderSinglePillarStep(4);     break;
      case 8: html += renderCapacityStep();          break;
      case 9: html += renderObstacleStep();          break;
    }

    html += '<div class="step-nav">';
    if (step > 1) {
      html += '<button class="btn-ghost" id="btn-back" aria-label="Go back">← Back</button>';
    } else {
      html += '<span></span>';
    }
    var nextLabel = (step === TOTAL_STEPS) ? 'Generate my action plan' : 'Continue →';
    html += '<button class="btn-primary" id="btn-next">' + nextLabel + '</button>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  // ── Step 1 — Email ──────────────────────────────────────────────────────────
  function renderEmailStep() {
    return '<h2 class="question-title">Your email address</h2>' +
      '<p class="question-sub">Your action plan will appear on screen straight away.</p>' +
      '<div class="field-wrap">' +
        '<input type="email" class="text-input" id="input-email" placeholder="you@example.com" value="' + esc(answers.email) + '" autocomplete="email" aria-label="Your email address" />' +
        '<div class="field-error" id="email-error" aria-live="polite"></div>' +
      '</div>';
  }

  // ── Step 2 — Expertise ──────────────────────────────────────────────────────
  function renderExpertiseStep() {
    return '<h2 class="question-title">What is your area of expertise?</h2>' +
      '<p class="question-sub">Be specific — this shapes every recommendation in your plan.</p>' +
      '<div class="field-wrap">' +
        '<input type="text" class="text-input" id="input-expertise" placeholder="E.g. nutrition coaching, leadership training, IT consulting…" value="' + esc(answers.expertise) + '" autocomplete="off" aria-label="Your area of expertise" />' +
        '<div class="field-error" id="expertise-error" aria-live="polite"></div>' +
      '</div>';
  }

  // ── Steps 3–7 — One pillar per page ─────────────────────────────────────────
  function renderSinglePillarStep(pillarIdx) {
    var pillar = PILLARS[pillarIdx];
    var q      = PILLAR_QUESTIONS[pillarIdx];
    var eyebrow = 'Pillar ' + (pillarIdx + 1) + ' of 5';

    return '<div class="pillar-eyebrow">' + esc(eyebrow) + '</div>' +
      '<h2 class="question-title">' + esc(q.title) + '</h2>' +
      '<p class="question-sub">Pick the description that sounds most like you right now — not where you want to be.</p>' +
      renderPillarGroup(pillar.key, q.opts, answers[pillar.key]) +
      '<div class="field-error" id="pillar-error" aria-live="polite"></div>';
  }

  // ── Step 8 — Capacity ────────────────────────────────────────────────────────
  function renderCapacityStep() {
    var hourOpts = [
      { value: '2-5h',   label: '2–5h per week' },
      { value: '5-10h',  label: '5–10h per week' },
      { value: '10-20h', label: '10–20h per week' },
      { value: '20h+',   label: '20h+ per week' }
    ];
    var teamOpts = [
      { value: 'Solo',       label: 'Solo' },
      { value: '1-2 people', label: '1–2 people' },
      { value: 'Team of 3+', label: 'Team of 3+' }
    ];

    return '<h2 class="question-title">Your available capacity.</h2>' +
      '<p class="question-sub">This lets OneTake calibrate your plan to what\'s actually doable for you.</p>' +
      '<div class="pillar-group">' +
        '<div class="pillar-label">How many hours per week can you dedicate to implementation?</div>' +
        renderCardList('hours_per_week', hourOpts, String(answers.hours_per_week), 'compact') +
        '<div class="field-error" id="hours-error" aria-live="polite"></div>' +
      '</div>' +
      '<div class="pillar-divider"></div>' +
      '<div class="pillar-group">' +
        '<div class="pillar-label">Do you work alone or with a team?</div>' +
        renderCardList('team', teamOpts, answers.team, 'compact') +
        '<div class="field-error" id="team-error" aria-live="polite"></div>' +
      '</div>';
  }

  // ── Step 9 — Obstacle ────────────────────────────────────────────────────────
  function renderObstacleStep() {
    return '<h2 class="question-title">What is your biggest obstacle right now?</h2>' +
      '<p class="question-sub">Describe in a few sentences what\'s blocking you the most. This is what your plan will speak to directly.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-obstacle" placeholder="Describe in a few sentences what\'s blocking you the most…" rows="5" autocomplete="off" aria-label="Your biggest obstacle">' + esc(answers.obstacle) + '</textarea>' +
        '<div class="field-error" id="obstacle-error" aria-live="polite"></div>' +
      '</div>';
  }

  // ── Pillar group helper ──────────────────────────────────────────────────────
  function renderPillarGroup(key, opts, current) {
    var html = '<div class="pillar-group">';
    html += '<ul class="card-list" role="radiogroup" aria-label="' + esc(key) + '">';
    opts.forEach(function (opt) {
      var sel = String(current) === opt.value ? ' selected' : '';
      html += '<li>' +
        '<button class="opt-card' + sel + '" role="radio" aria-checked="' + (sel ? 'true' : 'false') + '" data-name="' + esc(key) + '" data-value="' + esc(opt.value) + '" type="button">' +
          '<span class="opt-card-radio" aria-hidden="true"></span>' +
          '<span>' + esc(opt.label) + '</span>' +
        '</button>' +
      '</li>';
    });
    html += '</ul>';
    html += '</div>';
    return html;
  }

  // ── Card list (single-select) ───────────────────────────────────────────────
  function renderCardList(name, opts, current, modifier) {
    var listClass = 'card-list' + (modifier ? ' ' + modifier : '');
    var html = '<ul class="' + listClass + '" role="radiogroup" aria-label="' + esc(name) + '">';
    opts.forEach(function (opt) {
      var sel = current === opt.value ? ' selected' : '';
      html += '<li>' +
        '<button class="opt-card' + sel + '" role="radio" aria-checked="' + (sel ? 'true' : 'false') + '" data-name="' + esc(name) + '" data-value="' + esc(opt.value) + '" type="button">' +
          '<span class="opt-card-radio" aria-hidden="true"></span>' +
          '<span>' + esc(opt.label) + '</span>' +
        '</button>' +
      '</li>';
    });
    html += '</ul>';
    return html;
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  function renderLoading() {
    return '<div class="loading-shell">' +
      '<div class="loading-inner">' +
        '<div class="loading-dots" aria-hidden="true">' +
          '<div class="loading-dot"></div>' +
          '<div class="loading-dot"></div>' +
          '<div class="loading-dot"></div>' +
        '</div>' +
        '<h2 class="loading-title">Your action plan is being created…</h2>' +
        '<div class="loading-bar-wrap" role="progressbar" aria-label="Loading"><div class="loading-bar-fill"></div></div>' +
        '<p class="loading-message" id="loading-msg">The AI is analyzing your answers and building a plan tailored to your situation.</p>' +
      '</div>' +
    '</div>';
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  function renderError(isTimeout) {
    var msg = isTimeout
      ? 'Generation is taking longer than expected. Try again in a moment.'
      : 'Something went wrong. Try again in a moment.';
    return '<div class="error-shell">' +
      '<div class="error-inner">' +
        '<h2 class="error-title">' + (isTimeout ? 'Still loading…' : 'Something went wrong') + '</h2>' +
        '<p class="error-body">' + esc(msg) + '</p>' +
        '<button class="btn-primary" id="btn-retry">Try again</button>' +
      '</div>' +
    '</div>';
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  function renderResults(data) {
    var app = document.getElementById('app');

    var scores   = data.pillar_scores || {};
    var priority = data.priority_pillar || {};
    var plan     = data.plan || {};

    var html = '<div class="results-shell">';

    // Header
    html += '<div class="results-header">' +
      '<div class="results-eyebrow">High-Value Expert Action Plan · OneTake AI</div>' +
      '<h1 class="results-title">Your personalized action plan.</h1>' +
      '<p class="results-sub">Based on your situation, your priority pillar, and your capacity.</p>' +
    '</div>';

    // Section A — Radar chart
    html += '<div class="radar-section" id="radar-section">';
    html +=   '<div class="radar-section-heading">Your diagnostic</div>';
    html +=   '<div class="radar-wrap">' + renderRadarSVG(scores, priority.key) + '</div>';
    if (data.diagnostic_summary) {
      html += '<p class="radar-diagnostic">' + esc(data.diagnostic_summary) + '</p>';
    }
    html += '</div>';

    // Section B — Priority pillar
    var priorityLabel = priority.label || pillarKeyToLabel(priority.key);
    html += '<div class="priority-section" id="priority-section">';
    html +=   '<div class="priority-header">';
    html +=     '<div class="priority-eyebrow">Your priority pillar</div>';
    html +=     '<div class="priority-title">Your priority: ' + esc(priorityLabel) + '</div>';
    html +=   '</div>';
    html +=   '<div class="priority-body">';
    if (priority.why_first) {
      html += '<p class="priority-why">' + esc(priority.why_first) + '</p>';
    }
    if (priority.cercle_for_this_pillar) {
      html += '<p class="priority-cercle">' + renderMarkdownItalic(priority.cercle_for_this_pillar) + '</p>';
    }
    html +=   '</div>';
    html += '</div>';

    // Section C — 3-Horizon plan
    var thisWeek    = (plan.this_week && Array.isArray(plan.this_week)) ? plan.this_week : [];
    var thisMonth   = plan.this_month  || {};
    var threeMonths = plan.three_months || {};

    html += '<div class="plan-section" id="plan-section">';
    html +=   '<div class="plan-section-heading">Your action plan</div>';
    html +=   '<div class="plan-grid">';

    // This week
    html +=     '<div class="plan-card week">';
    html +=       '<div class="plan-card-header">';
    html +=         '<div class="plan-card-horizon">Horizon 1</div>';
    html +=         '<div class="plan-card-label">This week</div>';
    html +=       '</div>';
    html +=       '<div class="plan-card-body">';
    if (thisWeek.length > 0) {
      html +=       '<ul class="plan-actions">';
      thisWeek.forEach(function (action) {
        html +=     '<li>' + esc(action) + '</li>';
      });
      html +=       '</ul>';
    }
    html +=       '</div>';
    html +=     '</div>';

    // This month
    html +=     '<div class="plan-card month">';
    html +=       '<div class="plan-card-header">';
    html +=         '<div class="plan-card-horizon">Horizon 2</div>';
    html +=         '<div class="plan-card-label">This month</div>';
    html +=       '</div>';
    html +=       '<div class="plan-card-body">';
    if (thisMonth.content) {
      html +=     '<p class="plan-card-content">' + esc(thisMonth.content) + '</p>';
    }
    if (thisMonth.cercle_connection) {
      html +=     '<p class="plan-cercle-note">' + renderMarkdownItalic(thisMonth.cercle_connection) + '</p>';
    }
    html +=       '</div>';
    html +=     '</div>';

    // 3 months
    html +=     '<div class="plan-card quarter">';
    html +=       '<div class="plan-card-header">';
    html +=         '<div class="plan-card-horizon">Horizon 3</div>';
    html +=         '<div class="plan-card-label">In 3 months</div>';
    html +=       '</div>';
    html +=       '<div class="plan-card-body">';
    if (threeMonths.content) {
      html +=     '<p class="plan-card-content">' + esc(threeMonths.content) + '</p>';
    }
    if (threeMonths.cercle_next_step) {
      html +=     '<p class="plan-cercle-note">' + renderMarkdownItalic(threeMonths.cercle_next_step) + '</p>';
    }
    html +=       '</div>';
    html +=     '</div>';

    html +=   '</div>'; // .plan-grid
    html += '</div>'; // .plan-section

    // CTA
    html += '<div class="results-cta-wrap" id="results-cta">';
    html +=   '<p class="results-cta-sentence">This action plan was built using the same techniques taught in Le Cercle des Experts à Haute Valeur. Leave a comment under the video to share your results and let us know which pillar is your biggest focus right now.</p>';
    html +=   '<a href="' + CTA_URL + '" class="cta-btn">Leave my comment →</a>';
    html += '</div>';

    html += '</div>'; // .results-shell

    app.innerHTML = html;

    // Animate sections in sequence
    setTimeout(function () {
      var radarEl = document.getElementById('radar-section');
      if (radarEl) radarEl.classList.add('visible');
      animateRadar(scores, priority.key);
    }, 120);
    setTimeout(function () {
      var priorityEl = document.getElementById('priority-section');
      if (priorityEl) priorityEl.classList.add('visible');
    }, 480);
    setTimeout(function () {
      var planEl = document.getElementById('plan-section');
      if (planEl) planEl.classList.add('visible');
    }, 760);
    setTimeout(function () {
      var ctaEl = document.getElementById('results-cta');
      if (ctaEl) ctaEl.classList.add('visible');
    }, 1040);
  }

  // ── Radar SVG rendering ──────────────────────────────────────────────────────
  var CX = 200, CY = 195, MAX_R = 118, LABEL_R = 152;

  function pillarAngle(i) {
    return -Math.PI / 2 + (2 * Math.PI * i / 5);
  }

  function polarToCart(cx, cy, r, angle) {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function renderRadarSVG(scores, priorityKey) {
    var grid = '';
    [1, 2, 3].forEach(function (level) {
      var gPts = PILLARS.map(function (_, i) {
        var p = polarToCart(CX, CY, (level / 3) * MAX_R, pillarAngle(i));
        return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      }).join(' ');
      grid += '<polygon points="' + gPts + '" fill="none" stroke="rgba(28,43,58,0.12)" stroke-width="1"/>';
    });

    var axes = '';
    PILLARS.forEach(function (_, i) {
      var angle = pillarAngle(i);
      var outer = polarToCart(CX, CY, MAX_R, angle);
      axes += '<line x1="' + CX + '" y1="' + CY + '" x2="' + outer[0].toFixed(1) + '" y2="' + outer[1].toFixed(1) + '" stroke="rgba(28,43,58,0.10)" stroke-width="1"/>';
    });

    var polygon = '<polygon id="radar-polygon" points="' + CX + ',' + CY + ' ' + CX + ',' + CY + ' ' + CX + ',' + CY + ' ' + CX + ',' + CY + ' ' + CX + ',' + CY + '" fill="rgba(240,165,0,0.25)" stroke="#F0A500" stroke-width="2" stroke-linejoin="round"/>';

    var labels = '';
    PILLARS.forEach(function (pillar, i) {
      var angle = pillarAngle(i);
      var lp    = polarToCart(CX, CY, LABEL_R, angle);
      var lx    = lp[0], ly = lp[1];
      var anchor   = (i === 0 || i === 2 || i === 3) ? 'middle' : (i === 1 ? 'start' : 'end');
      var baseline = (i === 2 || i === 3) ? 'hanging' : (i === 0 ? 'auto' : 'central');
      var isPriority = pillar.key === priorityKey;
      var color  = isPriority ? '#F0A500' : '#1C2B3A';
      var weight = isPriority ? '700' : '600';
      labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '"' +
        ' text-anchor="' + anchor + '"' +
        ' dominant-baseline="' + baseline + '"' +
        ' font-size="12"' +
        ' font-weight="' + weight + '"' +
        ' font-family="Montserrat, Arial, sans-serif"' +
        ' fill="' + color + '">' +
        esc(pillar.label) +
      '</text>';
      var score = scores[pillar.key] || 1;
      var dotR  = (score / 3) * MAX_R;
      var dp    = polarToCart(CX, CY, dotR, angle);
      labels += '<circle cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" r="4" fill="' + (isPriority ? '#F0A500' : '#0099B4') + '" stroke="#fff" stroke-width="1.5"/>';
    });

    return '<svg viewBox="0 0 400 390" role="img" aria-label="5-pillar diagnostic radar chart">' +
      '<g>' + grid + axes + polygon + labels + '</g>' +
    '</svg>';
  }

  // ── Radar animation ───────────────────────────────────────────────────────────
  function animateRadar(scores) {
    var polygon = document.getElementById('radar-polygon');
    if (!polygon) return;

    var targetPts = PILLARS.map(function (pillar, i) {
      var score = scores[pillar.key] || 1;
      var r     = (score / 3) * MAX_R;
      return polarToCart(CX, CY, r, pillarAngle(i));
    });

    var startTime = null, duration = 900;

    function frame(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var t = 1 - Math.pow(1 - progress, 3);
      var pts = targetPts.map(function (tp) {
        return (CX + (tp[0] - CX) * t).toFixed(1) + ',' + (CY + (tp[1] - CY) * t).toFixed(1);
      }).join(' ');
      polygon.setAttribute('points', pts);
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  // ── Bind events ─────────────────────────────────────────────────────────────
  function bindStep(step) {
    if (step === 0) {
      var heroCta = document.getElementById('hero-cta');
      if (heroCta) heroCta.addEventListener('click', function () { render(1, 'forward'); });
      return;
    }

    if (step === 'error') {
      var retryBtn = document.getElementById('btn-retry');
      if (retryBtn) retryBtn.addEventListener('click', function () { render(10, 'forward'); });
      return;
    }

    var btnNext = document.getElementById('btn-next');
    var btnBack = document.getElementById('btn-back');
    if (btnNext) btnNext.addEventListener('click', function () { goNext(step); });
    if (btnBack) btnBack.addEventListener('click', function () { goBack(step); });

    var isPillarStep = (step >= 3 && step <= 7);

    document.querySelectorAll('.opt-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var name  = this.dataset.name;
        var value = this.dataset.value;

        document.querySelectorAll('.opt-card[data-name="' + name + '"]').forEach(function (c) {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        this.classList.add('selected');
        this.setAttribute('aria-checked', 'true');

        var isPillar = ['positioning','offer','video_content','sales_system','partnerships'].indexOf(name) !== -1;
        answers[name] = isPillar ? parseInt(value, 10) : value;

        clearError('pillar-error');
        clearError('hours-error');
        clearError('team-error');

        // Auto-advance on pillar steps
        if (isPillarStep) {
          setTimeout(function () { goNext(step); }, 180);
        }
      });
    });

    bindTextInput('input-email',     'email',    step, true);
    bindTextInput('input-expertise', 'expertise', step, false);
    bindTextInput('input-obstacle',  'obstacle',  step, false);
  }

  function bindTextInput(id, key, step, enterAdvances) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () { answers[key] = this.value.trim(); });
    if (enterAdvances) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          goNext(step);
        }
      });
    }
    setTimeout(function () {
      var current = document.getElementById(id);
      if (current) current.focus();
    }, 280);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function goNext(step) {
    if (!validate(step)) return;
    if (step < TOTAL_STEPS) {
      render(step + 1, 'forward');
    } else {
      render(10, 'forward');
    }
  }

  function goBack(step) {
    if (step > 1) render(step - 1, 'backward');
    else render(0, 'backward');
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(step) {
    switch (step) {
      case 1:
        if (!answers.email || !isValidEmail(answers.email)) {
          showError('email-error', 'Please enter a valid email address.');
          return false;
        }
        return true;
      case 2:
        if (!answers.expertise || answers.expertise.length < 2) {
          showError('expertise-error', 'This field is needed to personalize your plan.');
          return false;
        }
        return true;
      case 3:
        if (!answers.positioning) {
          showError('pillar-error', 'Please select an option to continue.');
          return false;
        }
        return true;
      case 4:
        if (!answers.offer) {
          showError('pillar-error', 'Please select an option to continue.');
          return false;
        }
        return true;
      case 5:
        if (!answers.video_content) {
          showError('pillar-error', 'Please select an option to continue.');
          return false;
        }
        return true;
      case 6:
        if (!answers.sales_system) {
          showError('pillar-error', 'Please select an option to continue.');
          return false;
        }
        return true;
      case 7:
        if (!answers.partnerships) {
          showError('pillar-error', 'Please select an option to continue.');
          return false;
        }
        return true;
      case 8:
        if (!answers.hours_per_week) {
          showError('hours-error', 'Please select how many hours you have available.');
          return false;
        }
        if (!answers.team) {
          showError('team-error', 'Please select your team situation.');
          return false;
        }
        return true;
      case 9:
        if (!answers.obstacle || answers.obstacle.length < 5) {
          showError('obstacle-error', 'This field is needed to personalize your plan.');
          return false;
        }
        return true;
    }
    return true;
  }

  function showError(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearError(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '';
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // ── Loading + API call ───────────────────────────────────────────────────────
  var LOADING_MESSAGES = [
    'The AI is analyzing your answers and building a plan tailored to your situation.',
    'Evaluating your positioning and offer…',
    'Analyzing your sales system and visibility…',
    'Identifying your highest-leverage pillar…',
    'Building your 3-horizon action plan…'
  ];

  function startLoading() {
    var msgEl  = document.getElementById('loading-msg');
    var msgIdx = 0;

    var interval = setInterval(function () {
      if (!msgEl) { clearInterval(interval); return; }
      msgEl.classList.add('fade-out');
      setTimeout(function () {
        msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
        if (msgEl) {
          msgEl.textContent = LOADING_MESSAGES[msgIdx];
          msgEl.classList.remove('fade-out');
        }
      }, 400);
    }, 3500);

    fireWebhook();

    if (PROXY_URL.indexOf('placeholder') !== -1) {
      setTimeout(function () {
        clearInterval(interval);
        renderResults(MOCK_RESPONSE);
      }, 3800);
    } else {
      var payload = buildPayload();
      lastPayload = payload;
      callProxy(payload, interval);
    }
  }

  function buildPayload() {
    return {
      tool:           'plan-action-vpl3',
      email:          answers.email,
      expertise:      answers.expertise,
      positioning:    answers.positioning,
      offer:          answers.offer,
      video_content:  answers.video_content,
      sales_system:   answers.sales_system,
      partnerships:   answers.partnerships,
      hours_per_week: answers.hours_per_week,
      team:           answers.team,
      obstacle:       answers.obstacle
    };
  }

  function callProxy(payload, interval) {
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, 45000);

    var opts = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ answers: payload })
    };
    if (controller) opts.signal = controller.signal;

    fetch(PROXY_URL, opts)
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (interval) clearInterval(interval);
        renderResults(data);
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (interval) clearInterval(interval);
        var isTimeout = err && err.name === 'AbortError';
        console.error('Proxy error:', err);
        var app = document.getElementById('app');
        if (app) app.innerHTML = renderError(isTimeout);
        bindStep('error');
      });
  }

  function fireWebhook() {
    var payload = buildPayload();
    payload.timestamp = new Date().toISOString();
    fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    }).catch(function (err) { console.error('Webhook error:', err); });
  }

  // ── Utility ─────────────────────────────────────────────────────────────────
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdownItalic(str) {
    if (!str) return '';
    return esc(str).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  function pillarKeyToLabel(key) {
    var map = {
      positioning:   'Positioning',
      offer:         'Offer',
      video_content: 'Video content',
      sales_system:  'Sales system',
      partnerships:  'Partnerships'
    };
    return map[key] || key;
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  init();

})();
