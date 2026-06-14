(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────
  var WEBHOOK_URL = 'https://placeholder.n8n.webhook/bilan';
  var PROXY_URL   = 'https://placeholder.bunny.proxy/api/bilan';
  var TOTAL_STEPS = 8; // steps 1–8 (not counting hero or results)

  // ── State ──────────────────────────────────────────────────
  var currentStep = 0; // 0 = hero
  var lastDirection = 'forward';
  var retryPayload = null;

  var answers = {
    email:       '',
    expertise:   '',
    years:       '',
    assets:      [],
    listSize:    '',
    salesMethod: '',
    weeklyHours: '',
    weekOff:     ''
  };

  // ── Mock response (used when PROXY_URL is a placeholder) ───
  var MOCK_RESPONSE = {
    profile: {
      score: 42,
      description: "Your business is partially autonomous, but you're still the main engine behind it. Sales slow down when you step away, which means you haven't yet built the systems that let your expertise work without you. The assets you already have are your fastest route to changing that."
    },
    dormantAssets: [
      {
        name: 'Your online course',
        potential: 'high',
        description: 'You have a course but it likely runs only when you launch it — converting it into an evergreen funnel could generate revenue every week without extra effort.'
      },
      {
        name: 'Your email list',
        potential: 'high',
        description: 'An email list is the most valuable asset a solo expert can own — but most treat it as a broadcast tool rather than an automated sales system.'
      },
      {
        name: 'Your videos and content',
        potential: 'medium',
        description: 'Your existing content is working harder than you think — but it could be systematically repurposed into lead magnets, mini-courses, and automated sequences.'
      }
    ],
    torrentCost: {
      hoursPerWeek: 14,
      weeksPerYear: 7,
      humanImpact: "That's roughly 500 hours a year — or 7 full work weeks — spent doing things that a well-built system could handle for you. Time you could spend creating, resting, or simply being present."
    },
    priorityLevers: [
      {
        title: 'Build one evergreen sales sequence',
        description: 'Take your best-performing launch emails and turn them into a 7-day automated sequence that runs every time someone joins your list. One week of setup, perpetual results.'
      },
      {
        title: 'Create a signature entry-point offer',
        description: "A low-ticket ($47–$97) product that solves one specific problem your audience has right now acts as a trust-builder and self-liquidating funnel. It converts strangers into buyers before they've met you."
      },
      {
        title: 'Repurpose your existing content into a lead magnet',
        description: "You already have the material — the work is in packaging it. A focused PDF guide or short video series built from content you've already created can become your most powerful list-building tool."
      }
    ],
    bridgeSentence: 'These are the exact levers covered in Sessions 2, 4, and 7 of Le Cercle des Experts à Haute Valeur — where you get live coaching to put them in place in your specific domain.'
  };

  // ── URL param: pre-fill email ──────────────────────────────
  var urlParams = new URLSearchParams(window.location.search);
  var emailParam = urlParams.get('email');
  if (emailParam) answers.email = emailParam;

  // ── Render entry ───────────────────────────────────────────
  function init() {
    if (emailParam) {
      // If email pre-filled, start at step 1 but keep email visible
      render(0);
    } else {
      render(0);
    }
  }

  function render(step, direction) {
    direction = direction || 'forward';
    lastDirection = direction;
    currentStep = step;

    var app = document.getElementById('app');
    var cls = direction === 'forward' ? 'step-enter' : 'step-enter-back';

    if (step === 0) {
      app.innerHTML = renderHero();
    } else if (step === 9) {
      app.innerHTML = renderLoading();
      startLoading();
    } else if (step === 10) {
      // results handled by renderResults()
    } else if (step === 'error') {
      app.innerHTML = renderError();
    } else {
      app.innerHTML = renderProgressBar(step) + renderStep(step);
    }

    // Animate in
    var inner = app.querySelector('.step-inner, .hero-shell, .loading-shell, .results-shell, .error-shell');
    if (inner) {
      inner.classList.add(cls);
    }

    // Bind events
    bindStep(step);
  }

  // ── Progress bar ───────────────────────────────────────────
  function renderProgressBar(step) {
    var pct = ((step - 1) / TOTAL_STEPS) * 100;
    return '<div class="progress-wrap" role="progressbar" aria-valuenow="' + step + '" aria-valuemin="1" aria-valuemax="' + TOTAL_STEPS + '" aria-label="Step ' + step + ' of ' + TOTAL_STEPS + '">' +
      '<div class="progress-fill" style="width:' + pct + '%"></div>' +
    '</div>';
  }

  // ── Hero ───────────────────────────────────────────────────
  function renderHero() {
    return '<div class="hero-shell">' +
      '<div class="hero-inner step-enter">' +
        '<div class="hero-eyebrow">OneTake AI · Free Assessment</div>' +
        '<h1 class="hero-title">Discover in 3 minutes what your expertise could generate — if you stopped being the only engine of your business.</h1>' +
        '<div class="hero-deco"></div>' +
        '<p class="hero-sub">Answer 8 quick questions about your expertise, your audience, and your work habits. OneTake analyzes your situation and reveals your dormant assets, your entrepreneur profile, and the real cost of the status quo.</p>' +
        '<button class="btn-primary" id="hero-cta" style="font-size:15px;padding:18px 40px;">' +
          'Start my assessment' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  // ── Steps ──────────────────────────────────────────────────
  function renderStep(step) {
    var html = '<div class="step-shell"><div class="step-inner">';
    html += '<div class="step-label">Step ' + step + ' of ' + TOTAL_STEPS + '</div>';

    switch (step) {
      case 1:
        html += renderEmailStep();
        break;
      case 2:
        html += renderExpertiseStep();
        break;
      case 3:
        html += renderYearsStep();
        break;
      case 4:
        html += renderAssetsStep();
        break;
      case 5:
        html += renderListSizeStep();
        break;
      case 6:
        html += renderSalesMethodStep();
        break;
      case 7:
        html += renderWeeklyHoursStep();
        break;
      case 8:
        html += renderWeekOffStep();
        break;
    }

    html += '</div>'; // step-inner

    html += '<div class="step-footer">';
    if (step > 1) {
      html += '<button class="btn-ghost" id="btn-back" aria-label="Go back">← Back</button>';
    } else {
      html += '<span></span>';
    }
    html += '<button class="btn-primary" id="btn-next">Next →</button>';
    html += '</div>';

    html += '</div>'; // step-shell
    return html;
  }

  function renderEmailStep() {
    return '<h2 class="question-title">What\'s your email address?</h2>' +
      '<p class="question-sub">Your results are generated in real time — we\'ll send them to this address so you can revisit them.</p>' +
      '<div class="field-wrap">' +
        '<input type="email" class="text-input" id="input-email" placeholder="you@example.com" value="' + esc(answers.email) + '" autocomplete="email" aria-label="Your email address" />' +
        '<div class="field-error" id="email-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderExpertiseStep() {
    return '<h2 class="question-title">What is your area of expertise?</h2>' +
      '<p class="question-sub">Be as specific as you like — the more detail, the more personalized your assessment.</p>' +
      '<div class="field-wrap">' +
        '<input type="text" class="text-input" id="input-expertise" placeholder="e.g. Life coaching, Dog training, B2B sales consulting" value="' + esc(answers.expertise) + '" autocomplete="off" aria-label="Your area of expertise" />' +
        '<div class="field-error" id="expertise-error" aria-live="polite"></div>' +
      '</div>';
  }

  function renderYearsStep() {
    var opts = [
      { value: '1-3', label: '1 – 3 years' },
      { value: '3-5', label: '3 – 5 years' },
      { value: '5-10', label: '5 – 10 years' },
      { value: '10+', label: '10+ years' }
    ];
    return '<h2 class="question-title">How many years have you been practicing?</h2>' +
      '<p class="question-sub">Include all time spent in your field, even if you weren\'t selling yet.</p>' +
      renderCardList('years', opts, answers.years);
  }

  function renderAssetsStep() {
    var opts = [
      { value: 'book', label: 'Book' },
      { value: 'course', label: 'Online course' },
      { value: 'videos', label: 'Videos / Podcast' },
      { value: 'articles', label: 'Articles / Blog' },
      { value: 'speaking', label: 'Speaking / Conferences' },
      { value: 'none', label: 'None of the above' }
    ];
    return '<h2 class="question-title">What assets have you already created?</h2>' +
      '<p class="question-sub">Select everything that applies — these are your dormant assets.</p>' +
      renderChipGrid('assets', opts, answers.assets) +
      '<div class="field-error" id="assets-error" aria-live="polite"></div>';
  }

  function renderListSizeStep() {
    var opts = [
      { value: 'none', label: 'No list' },
      { value: 'under-500', label: 'Under 500' },
      { value: '500-2k', label: '500 – 2,000' },
      { value: '2k-10k', label: '2,000 – 10,000' },
      { value: '10k+', label: '10,000+' }
    ];
    return '<h2 class="question-title">How big is your email list?</h2>' +
      '<p class="question-sub">Approximate is fine.</p>' +
      renderCardList('listSize', opts, answers.listSize);
  }

  function renderSalesMethodStep() {
    var opts = [
      { value: 'word-of-mouth', label: 'Word of mouth' },
      { value: 'content-social', label: 'Content + social media' },
      { value: 'occasional-launches', label: 'Occasional launches' },
      { value: 'automated', label: 'Automated system' },
      { value: 'mix', label: 'A mix of all of these' }
    ];
    return '<h2 class="question-title">How do you sell today?</h2>' +
      '<p class="question-sub">What\'s your primary source of new clients right now?</p>' +
      renderCardList('salesMethod', opts, answers.salesMethod);
  }

  function renderWeeklyHoursStep() {
    var opts = [
      { value: 'under-30', label: 'Under 30 hours' },
      { value: '30-40', label: '30 – 40 hours' },
      { value: '40-50', label: '40 – 50 hours' },
      { value: '50+', label: '50+ hours' }
    ];
    return '<h2 class="question-title">How many hours do you work per week?</h2>' +
      '<p class="question-sub">On average, including client work, admin, content, and marketing.</p>' +
      renderCardList('weeklyHours', opts, answers.weeklyHours);
  }

  function renderWeekOffStep() {
    var opts = [
      { value: 'keeps-going', label: 'Sales keep going' },
      { value: 'slows-down', label: 'They slow down' },
      { value: 'stops', label: 'They stop' },
      { value: 'dont-dare', label: "I don't dare take time off" }
    ];
    return '<h2 class="question-title">What happens when you take a week off?</h2>' +
      '<p class="question-sub">Be honest — this is the most revealing question.</p>' +
      renderCardList('weekOff', opts, answers.weekOff);
  }

  // ── Card / chip builders ───────────────────────────────────
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
    html += '<div class="field-error" id="' + name + '-error" aria-live="polite"></div>';
    return html;
  }

  function renderChipGrid(name, opts, current) {
    var html = '<div class="chip-grid" role="group" aria-label="Select assets">';
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

  // ── Loading screen ─────────────────────────────────────────
  function renderLoading() {
    return '<div class="loading-shell">' +
      '<div class="loading-inner">' +
        '<div class="loading-icon" aria-hidden="true">' +
          '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke="#E3AE28" stroke-width="2" stroke-dasharray="30 10"/><circle cx="14" cy="14" r="5" fill="#E3AE28" opacity="0.5"/></svg>' +
        '</div>' +
        '<h2 class="loading-title">Generating your assessment…</h2>' +
        '<div class="loading-bar-wrap" role="progressbar" aria-label="Loading"><div class="loading-bar-fill"></div></div>' +
        '<p class="loading-message" id="loading-msg">Analyzing your expert profile…</p>' +
      '</div>' +
    '</div>';
  }

  // ── Error screen ───────────────────────────────────────────
  function renderError() {
    return '<div class="error-shell">' +
      '<div class="error-inner">' +
        '<h2 class="error-title">Something went wrong</h2>' +
        '<p class="error-body">We couldn\'t generate your results. This is usually a temporary issue — please try again.</p>' +
        '<button class="btn-primary" id="btn-retry">Try again</button>' +
      '</div>' +
    '</div>';
  }

  // ── Results screen ─────────────────────────────────────────
  function renderResults(data) {
    var app = document.getElementById('app');
    var html = '<div class="results-shell">';

    // Header
    html += '<div class="results-header">' +
      '<div class="results-eyebrow">Your Free Expert Assessment</div>' +
      '<h1 class="results-title">Here\'s what OneTake found.</h1>' +
      '<p class="results-sub">Based on your answers — personalized for you.</p>' +
    '</div>';

    // Section A — Profile
    html += renderResultSection('A', 'Your Free Expert Profile',
      renderProfileContent(data.profile)
    );

    // Section B — Dormant Assets
    html += renderResultSection('B', 'Your Dormant Asset Inventory',
      renderAssetsContent(data.dormantAssets)
    );

    // Section C — Torrent Cost
    html += renderResultSection('C', 'The Cost of the Torrent',
      renderTorrentContent(data.torrentCost)
    );

    // Section D — Priority Levers
    html += renderResultSection('D', 'Your 3 Priority Levers',
      renderLeversContent(data.priorityLevers)
    );

    // Bridge + CTA
    html += '<div class="bridge-wrap" id="bridge-section">' +
      '<p class="bridge-sentence">' + esc(data.bridgeSentence) + '</p>' +
      '<a href="#cta-link" class="cta-btn">Join Le Cercle des Experts →</a>' +
    '</div>';

    html += '</div>'; // results-shell

    app.innerHTML = html;

    // Stagger fade-in
    var sections = app.querySelectorAll('.result-section');
    sections.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add('visible');
      }, 100 + i * 120);
    });
    setTimeout(function () {
      var bridge = app.querySelector('#bridge-section');
      if (bridge) bridge.classList.add('visible');
    }, 100 + sections.length * 120 + 100);
  }

  function renderResultSection(letter, title, body) {
    return '<div class="result-section" id="section-' + letter + '">' +
      '<div class="result-section-header">' +
        '<div class="result-section-label">Section ' + letter + '</div>' +
        '<div class="result-section-title">' + esc(title) + '</div>' +
      '</div>' +
      '<div class="result-section-body">' + body + '</div>' +
    '</div>';
  }

  function renderProfileContent(profile) {
    var score = typeof profile.score === 'number' ? profile.score : 0;
    return '<div class="profile-score-wrap">' +
      '<div class="profile-score-number">' + score + '<span class="profile-score-denom"> / 100</span></div>' +
      '<div class="profile-score-label">Free Entrepreneur Score</div>' +
    '</div>' +
    '<p class="profile-description">' + esc(profile.description) + '</p>';
  }

  function renderAssetsContent(assets) {
    if (!assets || !assets.length) return '<p style="color:var(--cedar-60);font-size:14px;">No specific assets identified.</p>';
    var html = '<ul class="asset-list">';
    assets.forEach(function (asset) {
      html += '<li class="asset-item">' +
        '<div>' +
          '<div class="asset-name">' + esc(asset.name) + '</div>' +
          '<div class="asset-desc">' + esc(asset.description) + '</div>' +
        '</div>' +
        '<span class="asset-potential ' + esc(asset.potential) + '" style="margin-left:auto;flex-shrink:0;">' + esc(asset.potential) + '</span>' +
      '</li>';
    });
    html += '</ul>';
    return html;
  }

  function renderTorrentContent(torrent) {
    return '<div class="torrent-figures">' +
      '<div class="torrent-fig">' +
        '<div class="torrent-number">' + esc(String(torrent.hoursPerWeek)) + '</div>' +
        '<div class="torrent-unit">Hours / week</div>' +
      '</div>' +
      '<div class="torrent-fig">' +
        '<div class="torrent-number">' + esc(String(torrent.weeksPerYear)) + '</div>' +
        '<div class="torrent-unit">Weeks / year</div>' +
      '</div>' +
    '</div>' +
    '<p class="torrent-impact">' + esc(torrent.humanImpact) + '</p>';
  }

  function renderLeversContent(levers) {
    if (!levers || !levers.length) return '';
    var html = '<ul class="levers-list">';
    levers.forEach(function (lever, i) {
      html += '<li class="lever-item">' +
        '<div class="lever-num">Lever ' + (i + 1) + '</div>' +
        '<div class="lever-title">' + esc(lever.title) + '</div>' +
        '<div class="lever-desc">' + esc(lever.description) + '</div>' +
      '</li>';
    });
    html += '</ul>';
    return html;
  }

  // ── Bind events ────────────────────────────────────────────
  function bindStep(step) {
    if (step === 0) {
      var heroCta = document.getElementById('hero-cta');
      if (heroCta) heroCta.addEventListener('click', function () {
        render(1, 'forward');
        // If email was pre-filled, focus Next button
        if (answers.email) {
          setTimeout(function () {
            var btn = document.getElementById('btn-next');
            if (btn) btn.focus();
          }, 300);
        }
      });
      return;
    }

    if (step === 'error') {
      var retryBtn = document.getElementById('btn-retry');
      if (retryBtn) retryBtn.addEventListener('click', function () {
        render(9, 'forward');
      });
      return;
    }

    var btnNext = document.getElementById('btn-next');
    var btnBack = document.getElementById('btn-back');

    if (btnNext) btnNext.addEventListener('click', function () { goNext(step); });
    if (btnBack) btnBack.addEventListener('click', function () { goBack(step); });

    // Card selection
    document.querySelectorAll('.opt-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var name = this.dataset.name;
        var value = this.dataset.value;
        document.querySelectorAll('.opt-card[data-name="' + name + '"]').forEach(function (c) {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        this.classList.add('selected');
        this.setAttribute('aria-checked', 'true');
        answers[name] = value;
        clearError(name + '-error');
      });
    });

    // Chip selection (multi)
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var value = this.dataset.value;
        var arr = answers.assets;
        if (value === 'none') {
          // Deselect all others
          answers.assets = arr.indexOf('none') !== -1 ? [] : ['none'];
          document.querySelectorAll('.chip').forEach(function (c) {
            var v = c.dataset.value;
            var selected = answers.assets.indexOf(v) !== -1;
            c.classList.toggle('selected', selected);
            c.setAttribute('aria-checked', selected ? 'true' : 'false');
          });
        } else {
          // Remove 'none' if selecting something real
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
          // Sync none chip
          var noneChip = document.querySelector('.chip[data-value="none"]');
          if (noneChip) {
            noneChip.classList.remove('selected');
            noneChip.setAttribute('aria-checked', 'false');
          }
        }
        clearError('assets-error');
      });
    });

    // Text inputs — sync to answers
    var emailInput = document.getElementById('input-email');
    if (emailInput) {
      emailInput.addEventListener('input', function () { answers.email = this.value.trim(); });
      emailInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') goNext(step); });
      setTimeout(function () { if (emailInput) emailInput.focus(); }, 280);
    }
    var expertiseInput = document.getElementById('input-expertise');
    if (expertiseInput) {
      expertiseInput.addEventListener('input', function () { answers.expertise = this.value.trim(); });
      expertiseInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') goNext(step); });
      setTimeout(function () { if (expertiseInput) expertiseInput.focus(); }, 280);
    }

    // Enter key on card-list questions
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter' && step >= 3 && step !== 4) {
        goNext(step);
        document.removeEventListener('keydown', handler);
      }
    });
  }

  // ── Navigation ─────────────────────────────────────────────
  function goNext(step) {
    if (!validate(step)) return;
    if (step < TOTAL_STEPS) {
      render(step + 1, 'forward');
    } else {
      // Step 8 done → loading
      render(9, 'forward');
    }
  }

  function goBack(step) {
    if (step > 1) render(step - 1, 'backward');
    else render(0, 'backward');
  }

  // ── Validation ─────────────────────────────────────────────
  function validate(step) {
    switch (step) {
      case 1:
        var email = answers.email;
        if (!email || !isValidEmail(email)) {
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
        if (!answers.years) { showError('years-error', 'Please select an option.'); return false; }
        return true;
      case 4:
        if (!answers.assets.length) { showError('assets-error', 'Please select at least one option.'); return false; }
        return true;
      case 5:
        if (!answers.listSize) { showError('listSize-error', 'Please select an option.'); return false; }
        return true;
      case 6:
        if (!answers.salesMethod) { showError('salesMethod-error', 'Please select an option.'); return false; }
        return true;
      case 7:
        if (!answers.weeklyHours) { showError('weeklyHours-error', 'Please select an option.'); return false; }
        return true;
      case 8:
        if (!answers.weekOff) { showError('weekOff-error', 'Please select an option.'); return false; }
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

  // ── Loading + API ──────────────────────────────────────────
  var LOADING_MESSAGES = [
    'Analyzing your expert profile…',
    'Mapping your dormant assets…',
    'Calculating the cost of the status quo…',
    'Identifying your priority levers…',
    'Personalizing your assessment…'
  ];

  function startLoading() {
    var msgEl = document.getElementById('loading-msg');
    var msgIdx = 0;

    var interval = setInterval(function () {
      if (!msgEl) { clearInterval(interval); return; }
      msgEl.classList.add('fade-out');
      setTimeout(function () {
        msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
        if (msgEl) {
          msgEl.textContent = LOADING_MESSAGES[msgIdx];
          msgEl.classList.remove('fade-out');
          msgEl.classList.add('fade-in');
        }
      }, 400);
    }, 3000);

    // Fire webhook (fire and forget)
    fireWebhook();

    // AI call (or mock)
    var payload = { answers: answers };
    retryPayload = payload;

    if (PROXY_URL.indexOf('placeholder') !== -1) {
      // Dev mode: use mock after simulated delay
      setTimeout(function () {
        clearInterval(interval);
        currentStep = 10;
        renderResults(MOCK_RESPONSE);
      }, 4000);
    } else {
      callProxy(payload, interval);
    }
  }

  function callProxy(payload, interval) {
    var timeout = 30000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, timeout);

    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
        currentStep = 10;
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'bilan-entrepreneur-libre',
        timestamp: new Date().toISOString(),
        email:       answers.email,
        expertise:   answers.expertise,
        years:       answers.years,
        assets:      answers.assets,
        listSize:    answers.listSize,
        salesMethod: answers.salesMethod,
        weeklyHours: answers.weeklyHours,
        weekOff:     answers.weekOff
      })
    }).catch(function (err) { console.error('Webhook error:', err); });
  }

  // ── Utility ────────────────────────────────────────────────
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Boot ───────────────────────────────────────────────────
  init();

})();
