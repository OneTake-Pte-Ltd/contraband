(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  var WEBHOOK_URL = 'https://placeholder.n8n.webhook/architect';
  var PROXY_URL   = 'https://proxy-ehv-mav-vpl2-architect-4eoze.bunny.run/api/architect';
  var CTA_URL     = 'https://try.onetake.ai/bootcamps/mav/vpl2-megaphone/#comments';
  var TOTAL_STEPS = 9;

  /*
   * Proxy system prompt guidance (implemented server-side):
   * 1. Return valid JSON matching the toboggan schema (no prose outside JSON)
   * 2. Generate 5–7 steps
   * 3. Name each step specifically for the user's business — never use generic
   *    labels like "Lead Magnet" or "Sales Page"
   * 4. Set status to "in_place" or "to_create" based on answers.existingContent
   *    and answers.hasLeadMagnet
   * 5. Integrate answers.sellingPoints and answers.objections into relevant steps
   * 6. Identify the single weakest link (highest-impact missing step)
   * 7. Suggest a lead magnet adapted to answers.expertise and answers.idealClient
   * 8. Respond in the language specified by answers.language
   *
   * Expected JSON schema:
   * {
   *   "toboggan": {
   *     "steps": [
   *       {
   *         "id": 1,
   *         "name": "...",         // personalized step title
   *         "type": "...",         // e.g. lead_magnet, email_sequence, webinar, main_offer
   *         "status": "in_place" | "to_create",
   *         "description": "...",
   *         "selling_points": [],  // strings (can be empty)
   *         "objection_responses": [], // strings (can be empty)
   *         "connection_label": "..." | null  // label on the connector arrow below this step
   *       }
   *     ]
   *   },
   *   "weakest_link": {
   *     "step_id": 1,
   *     "analysis": "...",
   *     "suggested_lead_magnet": "..."
   *   }
   * }
   */

  // ── Language config ─────────────────────────────────────────────────────────
  var LANGUAGES = [
    { code: 'en',    label: 'English' },
    { code: 'fr',    label: 'Français' },
    { code: 'es',    label: 'Español' },
    { code: 'pt-BR', label: 'Português (BR)' },
    { code: 'it',    label: 'Italiano' },
    { code: 'ja',    label: '日本語' }
  ];

  // ── State ───────────────────────────────────────────────────────────────────
  var currentStep = 0;
  var lastDirection = 'forward';

  var answers = {
    language:        detectDefaultLang(),
    email:           '',
    expertise:       '',
    idealClient:     '',
    coreProblem:     '',
    mainOffer:       '',
    sellingPoints:   '',
    objections:      '',
    existingContent: [],
    hasLeadMagnet:   '',
    leadMagnetDesc:  ''
  };

  // ── Mock response (used when PROXY_URL contains "placeholder") ──────────────
  var MOCK_RESPONSE = {
    toboggan: {
      steps: [
        {
          id: 1,
          name: "Free guide: '5 signs your expertise is keeping you trapped'",
          type: 'lead_magnet',
          status: 'to_create',
          description: 'Attracts ideal clients at the exact moment they realize they have a problem. Shared on LinkedIn and social media to bring cold traffic into your ecosystem without paid ads.',
          selling_points: [],
          objection_responses: [],
          connection_label: 'Email opt-in'
        },
        {
          id: 2,
          name: "4-email welcome sequence: 'The Expert\'s Paradox'",
          type: 'email_sequence',
          status: 'to_create',
          description: 'Builds trust over 7 days by teaching your core insight upfront. Positions you as the guide before any sales conversation happens.',
          selling_points: ['Proven with 200+ clients', 'Results visible in 90 days'],
          objection_responses: ["'My situation is different' — addressed in email 3 via diverse client examples"],
          connection_label: 'Invitation to webinar'
        },
        {
          id: 3,
          name: "Live webinar: 'The 3-step roadmap to a business that runs without you'",
          type: 'webinar',
          status: 'in_place',
          description: 'Your main conversion event. Teaches genuine value while positioning your program as the logical next step for prospects who are ready.',
          selling_points: ['Personal follow-up included', 'Live Q&A answers objections in real time'],
          objection_responses: [
            "'Too expensive' — ROI framing: one client pays back the investment",
            "'I don\'t have time' — show the time savings that kick in after month 2"
          ],
          connection_label: 'Registration link'
        },
        {
          id: 4,
          name: "6-month group coaching program 'The Free Expert'",
          type: 'main_offer',
          status: 'in_place',
          description: 'Your core product. Transforms experts who are the bottleneck in their own business into entrepreneurs with systems that sell and deliver without them.',
          selling_points: ['200+ clients helped', 'Results visible in 90 days', 'Personal follow-up included'],
          objection_responses: [],
          connection_label: 'Alumni community'
        },
        {
          id: 5,
          name: 'Alumni community + quarterly masterclasses',
          type: 'ascension',
          status: 'to_create',
          description: 'Retains clients after the program, generates organic referrals, and creates an upsell path to a higher-ticket annual membership.',
          selling_points: [],
          objection_responses: [],
          connection_label: null
        }
      ]
    },
    weakest_link: {
      step_id: 1,
      analysis: "Your Waterslide currently starts too late. You rely on word-of-mouth referrals, which means you attract warm prospects — but in small, unpredictable numbers. Without a lead magnet at the top, there is no systematic way to bring cold strangers into your world. This single missing piece is what keeps your pipeline dependent on luck rather than design.",
      suggested_lead_magnet: "Given your expertise, a high-value free guide would work extremely well — something like '5 signs your expertise is keeping you trapped' or a short self-assessment quiz. This type of content speaks directly to your ideal client's current frustration and can be promoted on LinkedIn and social media to attract new prospects 24/7, without you being present, placing it at the top of your Waterslide."
    }
  };

  // ── URL param: pre-fill email ───────────────────────────────────────────────
  var urlParams = new URLSearchParams(window.location.search);
  var emailParam = urlParams.get('email');
  if (emailParam) answers.email = decodeURIComponent(emailParam);

  // ── Language detection ──────────────────────────────────────────────────────
  function detectDefaultLang() {
    var lang = ((navigator.language || navigator.userLanguage) || 'en').toLowerCase();
    if (lang.startsWith('fr')) return 'fr';
    if (lang.startsWith('es')) return 'es';
    if (lang.startsWith('pt')) return 'pt-BR';
    if (lang.startsWith('it')) return 'it';
    if (lang.startsWith('ja')) return 'ja';
    return 'en';
  }

  // ── Language selector ───────────────────────────────────────────────────────
  function initLangSelector() {
    var wrap = document.getElementById('lang-selector-wrap');
    if (!wrap) return;
    var html = '<select class="lang-select" id="lang-select" aria-label="Language / Langue">';
    LANGUAGES.forEach(function (lang) {
      html += '<option value="' + lang.code + '"' + (answers.language === lang.code ? ' selected' : '') + '>' + lang.label + '</option>';
    });
    html += '</select>';
    wrap.innerHTML = html;
    var sel = document.getElementById('lang-select');
    if (sel) {
      sel.addEventListener('change', function () {
        answers.language = this.value;
      });
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    initLangSelector();
    render(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function render(step, direction) {
    direction = direction || 'forward';
    lastDirection = direction;
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
        '<div class="hero-eyebrow">OneTake AI · Visual Waterslide Architect</div>' +
        '<h1 class="hero-title">Visualize the exact sequence that turns a stranger into your client.</h1>' +
        '<div class="hero-deco"></div>' +
        '<p class="hero-sub">Answer 9 questions about your business. OneTake maps your complete Waterslide — your client journey from stranger to buyer — names every stage for your domain, flags the missing pieces, and identifies your single highest-impact gap.</p>' +
        '<button class="btn-primary" id="hero-cta" style="font-size:15px;padding:18px 40px;">Build my Waterslide →</button>' +
      '</div>' +
    '</div>';
  }

  // ── Steps shell ─────────────────────────────────────────────────────────────
  function renderStep(step) {
    var html = '<div class="step-shell"><div class="step-inner">';
    html += '<div class="step-label">Step ' + step + ' / ' + TOTAL_STEPS + '</div>';

    switch (step) {
      case 1: html += renderEmailStep();           break;
      case 2: html += renderExpertiseStep();       break;
      case 3: html += renderIdealClientStep();     break;
      case 4: html += renderCoreProblemStep();     break;
      case 5: html += renderMainOfferStep();       break;
      case 6: html += renderSellingPointsStep();   break;
      case 7: html += renderObjectionsStep();      break;
      case 8: html += renderExistingContentStep(); break;
      case 9: html += renderLeadMagnetStep();      break;
    }

    html += '<div class="step-nav">';
    if (step > 1) {
      html += '<button class="btn-ghost" id="btn-back" aria-label="Go back">← Back</button>';
    } else {
      html += '<span></span>';
    }
    html += '<button class="btn-primary" id="btn-next">Next →</button>';
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  function renderEmailStep() {
    return '<h2 class="question-title">What\'s your email address?</h2>' +
      '<p class="question-sub">Your Waterslide will appear on screen instantly. Leave your email so we can follow up with personalized advice.</p>' +
      '<div class="field-wrap">' +
        '<input type="email" class="text-input" id="input-email" placeholder="you@example.com" value="' + esc(answers.email) + '" autocomplete="email" aria-label="Your email address" />' +
        '<div class="field-error" id="email-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderExpertiseStep() {
    return '<h2 class="question-title">What is your area of expertise?</h2>' +
      '<p class="question-sub">Be as specific as possible — this shapes every label in your Waterslide.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-expertise" placeholder="e.g. Executive coaching, Canine behaviour, B2B leadership consulting" rows="3" autocomplete="off" aria-label="Area of expertise">' + esc(answers.expertise) + '</textarea>' +
        '<div class="field-hint">Enter to submit · Shift+Enter or Ctrl+Enter for a new line</div>' +
        '<div class="field-error" id="expertise-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderIdealClientStep() {
    return '<h2 class="question-title">Who is your ideal client?</h2>' +
      '<p class="question-sub">Think of the specific person who gets the most out of what you offer.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-ideal-client" placeholder="e.g. Experienced managers transitioning to entrepreneurship" rows="3" autocomplete="off" aria-label="Your ideal client">' + esc(answers.idealClient) + '</textarea>' +
        '<div class="field-hint">Enter to submit · Shift+Enter or Ctrl+Enter for a new line</div>' +
        '<div class="field-error" id="idealClient-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderCoreProblemStep() {
    return '<h2 class="question-title">What main problem do you solve for them?</h2>' +
      '<p class="question-sub">The core transformation you deliver — before and after.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-core-problem" placeholder="e.g. They have expertise but can\'t sell it without being in the room" rows="3" autocomplete="off" aria-label="Main problem you solve">' + esc(answers.coreProblem) + '</textarea>' +
        '<div class="field-hint">Enter to submit · Shift+Enter or Ctrl+Enter for a new line</div>' +
        '<div class="field-error" id="coreProblem-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderMainOfferStep() {
    return '<h2 class="question-title">What is your main offer and its approximate price?</h2>' +
      '<p class="question-sub">Your flagship product or service — the thing you sell most.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-main-offer" placeholder="e.g. 6-month group coaching program, €3,000" rows="3" autocomplete="off" aria-label="Main offer and price">' + esc(answers.mainOffer) + '</textarea>' +
        '<div class="field-hint">Enter to submit · Shift+Enter or Ctrl+Enter for a new line</div>' +
        '<div class="field-error" id="mainOffer-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderSellingPointsStep() {
    return '<h2 class="question-title">What do you need to communicate to convince a prospect?</h2>' +
      '<p class="question-sub">Your key selling points — the things that make skeptical prospects say yes.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-selling-points" placeholder="e.g. My method is proven with 200+ clients, results visible in 90 days, personal follow-up included…" aria-label="Key selling points" rows="5">' + esc(answers.sellingPoints) + '</textarea>' +
        '<div class="field-hint">Enter to submit · Shift+Enter or Ctrl+Enter for a new line</div>' +
        '<div class="field-error" id="sellingPoints-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderObjectionsStep() {
    return '<h2 class="question-title">What objections do your prospects typically raise?</h2>' +
      '<p class="question-sub">The hesitations that slow down or kill the sale.</p>' +
      '<div class="field-wrap">' +
        '<textarea class="textarea-input" id="input-objections" placeholder="e.g. It\'s too expensive, I don\'t have the time, my situation is different, I can figure it out alone…" aria-label="Typical objections" rows="5">' + esc(answers.objections) + '</textarea>' +
        '<div class="field-hint">Enter to submit · Shift+Enter or Ctrl+Enter for a new line</div>' +
        '<div class="field-error" id="objections-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderExistingContentStep() {
    var opts = [
      { value: 'videos',   label: 'Videos' },
      { value: 'articles', label: 'Articles / Blog' },
      { value: 'podcast',  label: 'Podcast' },
      { value: 'book',     label: 'Book' },
      { value: 'social',   label: 'Social media posts' },
      { value: 'none',     label: 'None yet' }
    ];
    return '<h2 class="question-title">What content do you already produce?</h2>' +
      '<p class="question-sub">Select all that apply — these become steps in your Waterslide.</p>' +
      renderChipGrid('existingContent', opts, answers.existingContent) +
      '<div class="field-error" id="existingContent-error" aria-live="polite"></div>';
  }

  function renderLeadMagnetStep() {
    var opts = [
      { value: 'yes', label: 'Yes, I have one' },
      { value: 'no',  label: 'Not yet' }
    ];
    return '<h2 class="question-title">Do you have a lead magnet or free entry-level resource?</h2>' +
      '<p class="question-sub">A free guide, quiz, video, or tool you offer to attract potential clients before they buy.</p>' +
      renderCardList('hasLeadMagnet', opts, answers.hasLeadMagnet) +
      '<div id="lead-magnet-desc-wrap" style="margin-top:20px;display:' + (answers.hasLeadMagnet === 'yes' ? 'block' : 'none') + ';">' +
        '<div class="field-wrap">' +
          '<textarea class="textarea-input" id="input-lead-magnet-desc" placeholder="e.g. A free quiz: What type of leader are you?" rows="3" autocomplete="off" aria-label="Describe your lead magnet">' + esc(answers.leadMagnetDesc) + '</textarea>' +
          '<div class="field-hint">Briefly describe it — what it is and who it\'s for. Enter to submit · Shift+Enter for a new line.</div>' +
          '<div class="field-error" id="leadMagnetDesc-error" aria-live="polite"></div>' +
        '</div>' +
      '</div>';
  }

  // ── Card list (single-select) ───────────────────────────────────────────────
  function renderCardList(name, opts, current) {
    var html = '<ul class="card-list" role="radiogroup" aria-label="' + esc(name) + '">';
    opts.forEach(function (opt) {
      var sel = current === opt.value ? ' selected' : '';
      html += '<li>' +
        '<button class="opt-card' + sel + '" role="radio" aria-checked="' + (sel ? 'true' : 'false') + '" data-name="' + name + '" data-value="' + esc(opt.value) + '" type="button">' +
          '<span class="opt-card-radio" aria-hidden="true"></span>' +
          '<span>' + esc(opt.label) + '</span>' +
        '</button>' +
      '</li>';
    });
    html += '</ul>';
    html += '<div class="field-error" id="' + esc(name) + '-error" aria-live="polite"></div>';
    return html;
  }

  // ── Chip grid (multi-select) ────────────────────────────────────────────────
  function renderChipGrid(name, opts, current) {
    var html = '<div class="chip-grid" role="group" aria-label="Select content types">';
    opts.forEach(function (opt) {
      var sel = current.indexOf(opt.value) !== -1 ? ' selected' : '';
      html += '<button class="chip' + sel + '" role="checkbox" aria-checked="' + (sel ? 'true' : 'false') + '" data-name="' + name + '" data-value="' + esc(opt.value) + '" type="button">' +
        '<span class="chip-check" aria-hidden="true"></span>' +
        '<span>' + esc(opt.label) + '</span>' +
      '</button>';
    });
    html += '</div>';
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
        '<h2 class="loading-title">Generating your Waterslide…</h2>' +
        '<div class="loading-bar-wrap" role="progressbar" aria-label="Loading"><div class="loading-bar-fill"></div></div>' +
        '<p class="loading-message" id="loading-msg">Mapping out your sales journey…</p>' +
      '</div>' +
    '</div>';
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  function renderError() {
    return '<div class="error-shell">' +
      '<div class="error-inner">' +
        '<h2 class="error-title">Something went wrong</h2>' +
        '<p class="error-body">We couldn\'t generate your Waterslide. This is usually temporary — please try again.</p>' +
        '<button class="btn-primary" id="btn-retry">Try again</button>' +
      '</div>' +
    '</div>';
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  function renderResults(data) {
    var app = document.getElementById('app');
    var steps = (data.toboggan && Array.isArray(data.toboggan.steps)) ? data.toboggan.steps : [];
    var wl    = data.weakest_link || {};

    var html = '<div class="results-shell">';

    // Header
    html += '<div class="results-header">' +
      '<div class="results-eyebrow">Visual Waterslide Architect · OneTake AI</div>' +
      '<h1 class="results-title">Your personalized Waterslide.</h1>' +
      '<p class="results-sub">Every step named for your business — in place or still to create.</p>' +
    '</div>';

    // Flowchart
    html += '<div class="toboggan-section">';
    html += '<div class="toboggan-label">Your complete client journey ↓</div>';
    html += '<div class="toboggan" id="toboggan-flow" role="list" aria-label="Your Waterslide steps">';

    steps.forEach(function (step, i) {
      var isInPlace   = step.status === 'in_place';
      var statusClass = isInPlace ? 'in-place' : 'to-create';
      var statusLabel = isInPlace ? '✅ In place' : '🔧 To create';

      // Start with opacity:0 — JS animates these in with stagger
      html += '<div class="tob-node ' + statusClass + '" id="tob-node-' + i + '" role="listitem" style="opacity:0;transform:translateY(24px);">';
      html += '<div class="tob-node-status">' + statusLabel + '</div>';
      html += '<div class="tob-node-name">' + esc(step.name) + '</div>';
      html += '<div class="tob-node-desc">' + esc(step.description) + '</div>';

      if (step.selling_points && step.selling_points.length > 0) {
        html += '<div class="tob-node-details">';
        html += '<div class="tob-detail-label">Selling points at this step</div>';
        html += '<ul class="tob-detail-list">';
        step.selling_points.forEach(function (sp) {
          html += '<li>' + esc(sp) + '</li>';
        });
        html += '</ul></div>';
      }

      if (step.objection_responses && step.objection_responses.length > 0) {
        html += '<div class="tob-node-details">';
        html += '<div class="tob-detail-label">Responding to objections</div>';
        html += '<ul class="tob-detail-list">';
        step.objection_responses.forEach(function (obj) {
          html += '<li>' + esc(obj) + '</li>';
        });
        html += '</ul></div>';
      }

      // Connection label lives inside the card so it inherits the card background
      if (i < steps.length - 1 && step.connection_label) {
        html += '<div class="tob-node-connection" style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.2);font-size:12px;font-weight:600;opacity:0.85;letter-spacing:0.02em;">↳ ' + esc(step.connection_label) + '</div>';
      }

      html += '</div>'; // .tob-node

      // Connector arrow only — label moved inside the node above
      if (i < steps.length - 1) {
        html += '<div class="tob-connector" id="tob-conn-' + i + '" style="opacity:0;" aria-hidden="true">';
        html += '<div class="tob-connector-arrow">↓</div>';
        html += '</div>';
      }
    });

    html += '</div>'; // .toboggan
    html += '</div>'; // .toboggan-section

    // Weakest link
    html += '<div class="weakest-link" id="weakest-link-section">';
    html +=   '<div class="weakest-link-header">';
    html +=     '<div class="weakest-link-eyebrow">Priority action</div>';
    html +=     '<div class="weakest-link-title">Your priority: the weakest link in your Waterslide</div>';
    html +=   '</div>';
    html +=   '<div class="weakest-link-body">';
    if (wl.analysis) {
      html += '<p class="weakest-link-analysis">' + esc(wl.analysis) + '</p>';
    }
    if (wl.suggested_lead_magnet) {
      html += '<div class="wl-magnet">';
      html +=   '<div class="wl-magnet-label">💡 Suggested lead magnet</div>';
      html +=   '<p class="wl-magnet-text">' + esc(wl.suggested_lead_magnet) + '</p>';
      html += '</div>';
    }
    html +=   '</div>';
    html += '</div>'; // .weakest-link

    // CTA
    html += '<div class="results-cta-wrap" id="results-cta">';
    html +=   '<p class="results-cta-sentence">This Waterslide was built using the techniques taught in Le Cercle des Experts à Haute Valeur. Share your results and tell us what you discovered.</p>';
    html +=   '<a href="' + CTA_URL + '" class="cta-btn">Share my results →</a>';
    html += '</div>';

    html += '</div>'; // .results-shell
    app.innerHTML = html;

    // Stagger-animate nodes
    steps.forEach(function (_, i) {
      setTimeout(function () {
        var nodeEl = document.getElementById('tob-node-' + i);
        if (nodeEl) {
          nodeEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          nodeEl.style.opacity    = '1';
          nodeEl.style.transform  = 'translateY(0)';
        }
        // Connector fades in shortly after its source node
        var connEl = document.getElementById('tob-conn-' + i);
        if (connEl) {
          setTimeout(function () {
            connEl.style.transition = 'opacity 0.35s ease';
            connEl.style.opacity    = '1';
          }, 220);
        }
      }, 160 + i * 280);
    });

    // Weakest link + CTA fade in after all nodes
    var afterNodes = 160 + steps.length * 280 + 300;
    setTimeout(function () {
      var wlEl = document.getElementById('weakest-link-section');
      if (wlEl) wlEl.classList.add('visible');
    }, afterNodes);
    setTimeout(function () {
      var ctaEl = document.getElementById('results-cta');
      if (ctaEl) ctaEl.classList.add('visible');
    }, afterNodes + 400);
  }

  // ── Bind events ─────────────────────────────────────────────────────────────
  function bindStep(step) {
    if (step === 0) {
      var heroCta = document.getElementById('hero-cta');
      if (heroCta) {
        heroCta.addEventListener('click', function () {
          render(1, 'forward');
          if (answers.email) {
            setTimeout(function () {
              var btn = document.getElementById('btn-next');
              if (btn) btn.focus();
            }, 300);
          }
        });
      }
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

    // ── Opt-card clicks (single-select) ─────────────────────────────────────
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
        answers[name] = value;
        clearError(name + '-error');

        // Show/hide lead magnet description
        if (name === 'hasLeadMagnet') {
          var wrap = document.getElementById('lead-magnet-desc-wrap');
          if (wrap) {
            wrap.style.display = (value === 'yes') ? 'block' : 'none';
            if (value === 'yes') {
              var inp = document.getElementById('input-lead-magnet-desc');
              if (inp) setTimeout(function () { inp.focus(); }, 60);
            }
          }
        }
      });
    });

    // ── Chip clicks (existingContent multi-select) ───────────────────────────
    document.querySelectorAll('.chip[data-name="existingContent"]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var value = this.dataset.value;
        var arr   = answers.existingContent;

        if (value === 'none') {
          // Toggle: if 'none' already selected, clear; otherwise select only 'none'
          answers.existingContent = (arr.indexOf('none') !== -1) ? [] : ['none'];
          document.querySelectorAll('.chip[data-name="existingContent"]').forEach(function (c) {
            var v   = c.dataset.value;
            var sel = answers.existingContent.indexOf(v) !== -1;
            c.classList.toggle('selected', sel);
            c.setAttribute('aria-checked', sel ? 'true' : 'false');
          });
        } else {
          // Deselect 'none' if a real option is picked
          var noneIdx = arr.indexOf('none');
          if (noneIdx !== -1) arr.splice(noneIdx, 1);

          var idx = arr.indexOf(value);
          if (idx !== -1) {
            arr.splice(idx, 1);
            this.classList.remove('selected');
            this.setAttribute('aria-checked', 'false');
          } else {
            arr.push(value);
            this.classList.add('selected');
            this.setAttribute('aria-checked', 'true');
          }
          // Sync 'none' chip state
          var noneChip = document.querySelector('.chip[data-name="existingContent"][data-value="none"]');
          if (noneChip) {
            noneChip.classList.remove('selected');
            noneChip.setAttribute('aria-checked', 'false');
          }
        }
        clearError('existingContent-error');
      });
    });

    // ── Text inputs ──────────────────────────────────────────────────────────
    bindTextInput('input-email', 'email', step, true);
    bindTextInput('input-expertise', 'expertise', step, true);
    bindTextInput('input-ideal-client', 'idealClient', step, true);
    bindTextInput('input-core-problem', 'coreProblem', step, true);
    bindTextInput('input-main-offer', 'mainOffer', step, true);
    bindTextInput('input-lead-magnet-desc', 'leadMagnetDesc', step, true);

    bindTextInput('input-selling-points', 'sellingPoints', step, true);
    bindTextInput('input-objections', 'objections', step, true);
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
    // Auto-focus only the primary (non-conditional) inputs
    if (!el.closest('#lead-magnet-desc-wrap')) {
      setTimeout(function () {
        var current = document.getElementById(id);
        if (current) current.focus();
      }, 280);
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function goNext(step) {
    if (!validate(step)) return;
    if (step < TOTAL_STEPS) {
      render(step + 1, 'forward');
    } else {
      render(10, 'forward'); // → loading
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
          showError('expertise-error', 'Please describe your area of expertise.');
          return false;
        }
        return true;
      case 3:
        if (!answers.idealClient || answers.idealClient.length < 2) {
          showError('idealClient-error', 'Please describe your ideal client.');
          return false;
        }
        return true;
      case 4:
        if (!answers.coreProblem || answers.coreProblem.length < 2) {
          showError('coreProblem-error', 'Please describe the main problem you solve.');
          return false;
        }
        return true;
      case 5:
        if (!answers.mainOffer || answers.mainOffer.length < 2) {
          showError('mainOffer-error', 'Please describe your main offer.');
          return false;
        }
        return true;
      case 6:
        if (!answers.sellingPoints || answers.sellingPoints.length < 10) {
          showError('sellingPoints-error', 'Please add at least a few key selling points.');
          return false;
        }
        return true;
      case 7:
        if (!answers.objections || answers.objections.length < 10) {
          showError('objections-error', 'Please list at least one or two typical objections.');
          return false;
        }
        return true;
      case 8:
        if (!answers.existingContent.length) {
          showError('existingContent-error', 'Please select at least one option.');
          return false;
        }
        return true;
      case 9:
        if (!answers.hasLeadMagnet) {
          showError('hasLeadMagnet-error', 'Please select an option.');
          return false;
        }
        if (answers.hasLeadMagnet === 'yes' && (!answers.leadMagnetDesc || answers.leadMagnetDesc.length < 2)) {
          showError('leadMagnetDesc-error', 'Please briefly describe your lead magnet.');
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
    'Mapping out your sales journey…',
    'Placing your selling points at the right steps…',
    'Weaving in responses to your objections…',
    'Identifying the missing pieces…',
    'Drawing your Waterslide…'
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
    }, 3000);

    // Fire webhook (non-blocking)
    fireWebhook();

    if (PROXY_URL.indexOf('placeholder') !== -1) {
      // Dev mode — use mock after simulated delay
      setTimeout(function () {
        clearInterval(interval);
        renderResults(MOCK_RESPONSE);
      }, 4200);
    } else {
      callProxy({ answers: answers }, interval);
    }
  }

  function callProxy(payload, interval) {
    var timeout    = 35000;
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer      = setTimeout(function () { if (controller) controller.abort(); }, timeout);

    var opts = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
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
        console.error('Proxy error:', err);
        render('error', 'forward');
      });
  }

  function fireWebhook() {
    fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool:            'architecte-visuel-waterslide',
        timestamp:       new Date().toISOString(),
        language:        answers.language,
        email:           answers.email,
        expertise:       answers.expertise,
        idealClient:     answers.idealClient,
        coreProblem:     answers.coreProblem,
        mainOffer:       answers.mainOffer,
        sellingPoints:   answers.sellingPoints,
        objections:      answers.objections,
        existingContent: answers.existingContent,
        hasLeadMagnet:   answers.hasLeadMagnet,
        leadMagnetDesc:  answers.leadMagnetDesc
      })
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

  // ── Boot ─────────────────────────────────────────────────────────────────────
  init();

})();
