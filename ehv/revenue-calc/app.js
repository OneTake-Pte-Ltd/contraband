/* Revenue-Oriented Content Calculator — OneTake AI */
(function () {
  'use strict';

  // ── Proxy URL (replace with your Bunny Edge Script endpoint) ──────────────
  var PROXY_URL = 'https://userlist-proxy-for-launch-opt-ins-9yd8d.bunny.run/track';

  // ── Constants ─────────────────────────────────────────────────────────────
  var PLATFORM_META = [
    { key: 'youtube',   label: 'YouTube',          kind: 'long',  color: '#9c4a1c' },
    { key: 'instagram', label: 'Instagram',         kind: 'short', color: '#5a6f8a' },
    { key: 'tiktok',    label: 'TikTok',            kind: 'short', color: '#3a3a3a' },
    { key: 'linkedin',  label: 'LinkedIn',          kind: 'long',  color: '#2d5e3e' },
    { key: 'podcast',   label: 'Podcast',           kind: 'long',  color: '#7a5a2a' },
    { key: 'facebook',  label: 'Facebook',          kind: 'short', color: '#8a8a4a' },
  ];
  var EMAIL_META = { key: 'email', label: 'Email newsletter', kind: 'owned', color: '#1a1a1a' };
  var ALL_PLATFORMS = PLATFORM_META.concat([EMAIL_META]);

  var ACTIVITY_OPTIONS = [
    'Coaching', 'Consulting', 'Online courses', 'In-person training',
    'Books', 'Mastermind groups', 'Software', 'Therapy', 'E-commerce', 'Other',
  ];

  var CURR = {
    EUR: { sym: '€', rate: 1 },
    USD: { sym: '$', rate: 1.08 },
  };

  var STEPS = [
    'name', 'audience', 'activity', 'activitySecondary',
    'platforms', 'followers', 'cadence', 'hours', 'price',
    'email', 'computing', 'result',
  ];
  var FORM_STEPS_TOTAL = 10;

  var EDIT_MAP = {
    audience:   'audience',
    activity:   'activity',
    platforms:  'platforms',
    followers:  'followers',
    cadence:    'cadence',
    hours:      'hours',
    price:      'price',
  };

  function defaultPlatforms() {
    var p = {};
    ALL_PLATFORMS.forEach(function (m) {
      p[m.key] = { active: false, followers: 0, freq: 0 };
          });
    return p;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var state = {
    firstName: '',
    email: '',
    audience: 'B2C',
    activity: '',
    activityOther: '',
    activitySecondary: [],
    platforms: defaultPlatforms(),
    hoursPerWeek: 1,
    priceLow: 50,
    priceHigh: 1000,
    currency: 'EUR',
  };

  var stepIdx = 0;
  var editing = false;

  // ── GET-param prefill ──────────────────────────────────────────────────────
  (function prefill() {
    var p = new URLSearchParams(window.location.search);
    var fn = p.get('firstName') || p.get('first_name') || '';
    var em = p.get('email') || '';
    if (fn) { state.firstName = fn; stepIdx = 1; }
    if (em) state.email = em;
  })();

  // ── Math ──────────────────────────────────────────────────────────────────
  function activePlatformsList(s) {
    return PLATFORM_META.filter(function (m) { return s.platforms[m.key].active; });
  }
  function totalSocial(s) {
    return activePlatformsList(s).reduce(function (acc, m) { return acc + (s.platforms[m.key].followers || 0); }, 0);
  }
  function totalLongFormFreq(s) {
    return PLATFORM_META.filter(function (m) { return m.kind === 'long' && s.platforms[m.key].active; })
      .reduce(function (acc, m) { return acc + s.platforms[m.key].freq; }, 0);
  }
  function totalFreq(s) {
    var social = activePlatformsList(s).reduce(function (acc, m) { return acc + s.platforms[m.key].freq; }, 0);
    var email = s.platforms.email.active ? s.platforms.email.freq : 0;
    return social + email;
  }

  function computeProjection(s) {
    var hours = s.hoursPerWeek || 0;
    var monthlyGrowth = Math.min(hours * 0.08, 0.25); // capped at 25%/month
    var b2bMult = s.audience === 'B2B' ? 2.5 : 1;
    var active = activePlatformsList(s);

    // Per-platform series: 13 points (month 0 → 12)
    var platformSeries = {};
    active.forEach(function (m) {
      var base = Math.max(s.platforms[m.key].followers || 0, 1);
      var arr = [];
      var v = base;
      for (var i = 0; i <= 12; i++) {
        arr.push(Math.round(v));
        v = v * (1 + monthlyGrowth);
      }
      platformSeries[m.key] = arr;
    });

    // Email series (own growth + 25% of new long-form subs + 10% of new short-form subs)
    var emailActive = s.platforms.email.active;
    var currentEmail = emailActive ? (s.platforms.email.followers || 0) : 0;
    var emailSeries = [];
    var ev = emailActive ? Math.max(currentEmail, 1) : currentEmail;
    for (var i = 0; i <= 12; i++) {
      emailSeries.push(Math.round(ev));
      if (i < 12) {
        var ownGrowth = emailActive ? ev * monthlyGrowth : 0;
        var socialConversions = 0;
        PLATFORM_META.forEach(function (m) {
          if (s.platforms[m.key].active && platformSeries[m.key]) {
            var newSubs = platformSeries[m.key][i + 1] - platformSeries[m.key][i];
            if (m.kind === 'long') socialConversions += newSubs * 0.25;
            else if (m.kind === 'short') socialConversions += newSubs * 0.10;
          }
        });
        ev = ev + ownGrowth + socialConversions;
      }
    }

    // Revenue series (driven by email list × b2b mult)
    var revenue = emailSeries.map(function (email, i) {
      var r = email * 1 * b2bMult;
      return { month: i, revenue: Math.round(r), personal: Math.round(r * 0.4) };
    });

    // Social totals per month
    var socialSeries = [];
    for (var i = 0; i <= 12; i++) {
      socialSeries.push(active.reduce(function (acc, m) { return acc + platformSeries[m.key][i]; }, 0));
    }

    var m12 = revenue[12];
    var today = revenue[0];
    var social0 = socialSeries[0];
    var targetEmail = Math.max(social0, 2000);

    var priceLow = s.priceLow || 1;
    function roundUpToPrice(v) {
      if (!priceLow || priceLow <= 0) return v;
      return Math.ceil(v / priceLow) * priceLow;
    }

    return {
      currentMonthlyRevenue: roundUpToPrice(today.revenue),
      targetMonthlyRevenue: roundUpToPrice(m12.revenue),
      targetPersonalIncome: roundUpToPrice(m12.personal),
      annualRevenue: roundUpToPrice(m12.revenue * 12),
      currentEmail: currentEmail,
      targetEmail: targetEmail,
      emailGap: Math.max(0, targetEmail - currentEmail),
      revenue: revenue,
      platformSeries: platformSeries,
      emailSeries: emailSeries,
      socialSeries: socialSeries,
      monthlyGrowth: monthlyGrowth,
      b2bMult: b2bMult,
      longForm: totalLongFormFreq(s),
    };
  }

  function diagnose(s, proj) {
    var issues = [];
    var emailActive = s.platforms.email.active;
    if (!emailActive || proj.emailGap > 300) {
      issues.push({
        key: 'email',
        headline: emailActive ? 'Your email list is the bottleneck.' : "You don't have an email list yet.",
        body: emailActive
          ? 'You have ' + fmtInt(proj.currentEmail) + ' subscribers. The rule of thumb: your list should be at least as large as the sum of your social followings — that\'s ' + fmtInt(proj.targetEmail) + ". You're sitting on " + fmtInt(proj.emailGap) + " subscribers' worth of latent revenue."
          : 'You have ' + fmtInt(proj.targetEmail) + " potential subscribers across social — and zero way to reach them when the algorithm decides otherwise. This is the single biggest leak in your business.",
        lever: emailActive ? 'Build one lead magnet. Pipe every platform to the opt-in.' : 'Set up the list this week. Lead magnet, opt-in, one welcome email. That\'s it.',
      });
    }
    if (proj.longForm < 3 && s.hoursPerWeek >= 3) {
      issues.push({
        key: 'longform',
        headline: "You're under-publishing on longer content.",
        body: 'You publish ' + proj.longForm + ' longer content pieces per week across YouTube, LinkedIn, and Podcast. With ' + s.hoursPerWeek + 'h available, you have capacity for ' + Math.min(s.hoursPerWeek, 7) + ". The gap is what your competitors are filling.",
        lever: 'Pick one longer content channel. Commit to weekly.',
      });
    }
    if (s.priceHigh > 0 && s.audience === 'B2B' && s.priceHigh < 2500) {
      issues.push({
        key: 'price',
        headline: 'Your prices are below market for B2B.',
        body: 'Your high ticket is ' + fmtMoney(s.priceHigh, 'EUR') + '. B2B buyers expect — and pay — between €3,000 and €15,000 for a premium engagement. You are pricing yourself out of your real market.',
        lever: 'Raise your high ticket by 2.5× on the next cycle.',
      });
    } else if (s.priceHigh > 0 && s.audience === 'B2C' && s.priceHigh < 1000) {
      issues.push({
        key: 'price',
        headline: "Your highest ticket is a lever you haven't pulled.",
        body: 'Your high ticket is ' + fmtMoney(s.priceHigh, 'EUR') + ". Most B2C expert businesses unlock their next revenue level by introducing one premium offer above €1,000.",
        lever: 'Design one offer at or above €1,000. A workshop, a mastermind, a done-with-you program.',
      });
    }
    if (s.platforms.tiktok.active && s.platforms.tiktok.freq > 4 && proj.longForm < 2) {
      issues.push({
        key: 'shortform',
        headline: "You're feeding the algorithm, not your business.",
        body: "Short content is busy work. It builds reach for the platform. Longer content builds trust for you.",
        lever: 'Cut TikTok to twice a week. Reinvest the hours.',
      });
    }
    if (s.hoursPerWeek > 0 && s.hoursPerWeek < 3) {
      issues.push({
        key: 'hours',
        headline: "You're starving your business of time.",
        body: 'You allocate ' + s.hoursPerWeek + "h/week to content. That's barely enough for one longer content post. Your ceiling is set here.",
        lever: 'Carve out one untouchable half-day per week. Non-negotiable.',
      });
    }
    if (issues.length === 0) {
      issues.push({
        key: 'execute',
        headline: 'The system is in place. Now execute.',
        body: 'Your foundations are sound. The lever from here is consistency — and pricing.',
        lever: 'Audit your funnel. Find the one leak. Fix it.',
      });
    }
    return issues;
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function fmtMoney(n, c) {
    var cur = CURR[c] || CURR.EUR;
    return cur.sym + Math.round(n * cur.rate).toLocaleString('en-US');
  }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // ── DOM helpers ───────────────────────────────────────────────────────────
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null) return;
        if (k === 'style' && typeof v === 'object') {
          Object.assign(el.style, v);
        } else if (k === 'className') {
          el.className = v;
        } else if (k === 'htmlFor') {
          el.htmlFor = v;
        } else if (k === 'textContent') {
          el.textContent = v;
        } else if (k === 'innerHTML') {
          el.innerHTML = v;
        } else if (k === 'disabled') {
          el.disabled = !!v;
        } else if (k === 'checked') {
          el.checked = !!v;
        } else if (k === 'value') {
          el.setAttribute('value', String(v));
          el.value = String(v);
        } else if (k.startsWith('on') && typeof v === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          el.setAttribute(k, String(v));
        }
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      append(el, child);
    }
    return el;
  }
  function append(parent) {
    for (var _i = 1; _i < arguments.length; _i++) {
      var child = arguments[_i];
      if (child == null || child === false) continue;
      if (Array.isArray(child)) {
        child.forEach(function (c) { append(parent, c); });
      } else if (child instanceof Node) {
        parent.appendChild(child);
      } else {
        parent.appendChild(document.createTextNode(String(child)));
      }
    }
  }
  function t(text) { return document.createTextNode(String(text)); }

  // ── SVG helpers ───────────────────────────────────────────────────────────
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
    }
    return el;
  }
  function buildSparklinePath(data, w, h, scaleMax) {
    var max = scaleMax != null ? scaleMax : Math.max.apply(null, data);
    var min = 0;
    var range = max - min || 1;
    var stepX = w / (data.length - 1);
    var pts = data.map(function (v, i) {
      return [i * stepX, h - ((v - min) / range) * (h - 4) - 2];
    });
    return pts.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }).join(' ');
  }
  function buildGridlines(w, h) {
    var g = svgEl('g');
    [0.25, 0.5, 0.75].forEach(function (pct) {
      var line = svgEl('line', {
        x1: 0, x2: w,
        y1: (h * (1 - pct)).toFixed(2),
        y2: (h * (1 - pct)).toFixed(2),
        stroke: 'rgba(26,26,26,0.06)',
        'stroke-width': 1,
      });
      g.appendChild(line);
    });
    return g;
  }

  // ── Count-up animation ────────────────────────────────────────────────────
  function countUp(el, target, formatFn, duration) {
    duration = duration || 1800;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatFn(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function dispatch(patch) {
    Object.assign(state, patch);
    render();
  }
  function goTo(name) {
    stepIdx = STEPS.indexOf(name);
    render();
    window.scrollTo(0, 0);
  }
  function goNext() {
    if (editing) { editing = false; goTo('result'); return; }
    var next = stepIdx + 1;
    // Skip email gate if email already provided via GET param
    var params = new URLSearchParams(window.location.search);
    if (STEPS[next] === 'email' && (params.get('email') || '').trim()) next++;
    stepIdx = Math.min(next, STEPS.length - 1);
    render();
    window.scrollTo(0, 0);
  }
  function goBack() {
    if (editing) { editing = false; goTo('result'); return; }
    var prev = stepIdx - 1;
    var params = new URLSearchParams(window.location.search);
    if (STEPS[prev] === 'email' && (params.get('email') || '').trim()) prev--;
    stepIdx = Math.max(prev, 0);
    render();
    window.scrollTo(0, 0);
  }
  function onEdit(target) {
    editing = true;
    goTo(EDIT_MAP[target] || target);
    window.scrollTo(0, 0);
  }
  function restart() {
    state = Object.assign({
      firstName: '', email: '', audience: 'B2C',
      activity: '', activityOther: '', activitySecondary: [],
      platforms: defaultPlatforms(),
      hoursPerWeek: 1, priceLow: 50, priceHigh: 1000, currency: 'EUR',
    }, (function () {
      var p = new URLSearchParams(window.location.search);
      return {
        firstName: p.get('firstName') || p.get('first_name') || '',
        email: p.get('email') || '',
      };
    })());
    editing = false;
    var params = new URLSearchParams(window.location.search);
    stepIdx = (params.get('firstName') || params.get('first_name')) ? 1 : 0;
    render();
    window.scrollTo(0, 0);
  }

  // ── Shared UI components ──────────────────────────────────────────────────
  function buildProgressBar(step, total) {
    var segs = [];
    for (var i = 0; i < total; i++) {
      segs.push(h('div', { className: 'progress-seg' + (i < step ? ' done' : '') }));
    }
    return h('div', null,
      h('div', { className: 'progress-meta' },
        h('span', { className: 'small-mono', textContent: 'Step ' + pad2(step) + ' of ' + pad2(total) }),
        h('span', { className: 'small-mono', textContent: 'Revenue-Oriented Content Calculator' })
      ),
      h('div', { className: 'progress-bar' }, segs)
    );
  }

  function buildStepShell(opts) {
    var step = opts.step, total = opts.total;
    var onNext = opts.onNext, onBack = opts.onBack;
    var nextDisabled = opts.nextDisabled, nextLabel = opts.nextLabel;
    var hideBack = opts.hideBack, eyebrow = opts.eyebrow, showAutosave = opts.showAutosave;

    var label = editing ? 'Save & back to result →' : (nextLabel || 'Continue →');

    var nextBtn = h('button', {
      className: 'btn-primary',
      disabled: !!nextDisabled,
      onClick: onNext,
    }, label);

    var footer = h('div', { className: 'step-footer' },
      hideBack
        ? h('span', null)
        : h('button', { className: 'btn-ghost', onClick: onBack }, '← Back'),
      showAutosave ? h('div', { className: 'small-mono', textContent: 'Autosaved' }) : h('span', null),
      nextBtn
    );

    var bodyEl = h('div', { className: 'step-body' });
    if (eyebrow) {
      bodyEl.appendChild(h('div', { className: 'eyebrow', textContent: eyebrow }));
    }

    var shell = h('div', { className: 'step-shell' },
      buildProgressBar(step, total),
      bodyEl,
      footer
    );

    // Expose body on shell so render functions can append into it
    shell._body = bodyEl;
    return shell;
  }

  function buildCurrencyToggle(value, onChange) {
    var eur = h('button', {
      className: value === 'EUR' ? 'on' : '',
      onClick: function () { onChange('EUR'); },
    }, h('span', null, 'EUR'));
    var usd = h('button', {
      className: value === 'USD' ? 'on' : '',
      onClick: function () { onChange('USD'); },
    }, h('span', null, 'USD'));
    return h('div', { className: 'currency-toggle' }, eur, usd);
  }

  function buildDualRange(low, high, opts) {
    var min = opts.min, max = opts.max, step = opts.step || 50;
    var onChange = opts.onChange;

    function pct(v) { return ((v - min) / (max - min)) * 100; }

    var trackBg = h('div', { className: 'dual-range__track-bg' });
    var trackFill = h('div', { className: 'dual-range__track-fill' });

    function updateFill() {
      trackFill.style.left = pct(lowIn.value) + '%';
      trackFill.style.right = (100 - pct(highIn.value)) + '%';
    }

    var lowIn = h('input', {
      type: 'range', min: min, max: max, step: step, value: low,
      style: { zIndex: 2 },
      onInput: function () {
        var v = parseInt(lowIn.value, 10);
        var hi = parseInt(highIn.value, 10);
        if (v > hi) { lowIn.value = hi; v = hi; }
        updateFill();
        onChange(v, hi);
      },
    });
    var highIn = h('input', {
      type: 'range', min: min, max: max, step: step, value: high,
      style: { zIndex: 3 },
      onInput: function () {
        var v = parseInt(highIn.value, 10);
        var lo = parseInt(lowIn.value, 10);
        if (v < lo) { highIn.value = lo; v = lo; }
        updateFill();
        onChange(lo, v);
      },
    });

    updateFill();

    return h('div', { className: 'dual-range' }, trackBg, trackFill, lowIn, highIn);
  }

  function buildFreqSlider(value, maxVal, onChange, isEmail) {
    var ticks = isEmail
      ? ['0', '8', '16', '24', '31+']
      : ['0', '1', '2', '3', '4', '5', '6', '7+'];

    var tickEls = ticks.map(function (t) { return h('span', { textContent: t }); });
    var input = h('input', {
      type: 'range', min: 0, max: maxVal, step: 1, value: Math.min(value, maxVal),
      onInput: function () { onChange(parseInt(input.value, 10)); },
    });
    return h('div', null,
      h('div', { className: 'freq-ticks' }, tickEls),
      input
    );
  }

  function buildPencilIcon(size) {
    size = size || 13;
    var svg = svgEl('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', style: 'display:block' });
    var p1 = svgEl('path', {
      d: 'M11.3 1.7l3 3-8.6 8.6-3.7.7.7-3.7 8.6-8.6z',
      stroke: 'currentColor', 'stroke-width': '1.2',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    });
    var p2 = svgEl('path', {
      d: 'M9.8 3.2l3 3',
      stroke: 'currentColor', 'stroke-width': '1.2',
    });
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
  }

  // ── Form steps ────────────────────────────────────────────────────────────

  function renderName() {
    var shell = buildStepShell({
      step: 1, total: FORM_STEPS_TOTAL,
      hideBack: true,
      eyebrow: "Step 1 · Let’s start with you",
      onNext: goNext,
      nextDisabled: !state.firstName.trim(),
    });
    var input = h('input', {
      type: 'text', className: 'text-input',
      placeholder: 'Michelle',
      value: state.firstName,
      autofocus: true,
      onInput: function () {
        state.firstName = input.value;
        nextBtn().disabled = !state.firstName.trim();
      },
      onKeydown: function (e) {
        if (e.key === 'Enter' && state.firstName.trim()) goNext();
      },
    });

    function nextBtn() { return shell.querySelector('.btn-primary'); }

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: "What's your first name?" }),
      h('div', { style: { marginTop: '32px', maxWidth: '480px' } }, input)
    );
    return shell;
  }

  function renderAudience() {
    var shell = buildStepShell({
      step: 2, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 2 · Who do you sell to',
      onNext: goNext, onBack: goBack,
    });
    var options = [
      { k: 'B2C', title: 'B2C', body: 'Individuals pay you directly. Coaching clients, students, patients, customers. Smaller tickets, larger volume.' },
      { k: 'B2B', title: 'B2B', body: 'Companies pay you. Consulting retainers, corporate training, paid programs. Bigger tickets, longer cycles.' },
    ];
    var cards = options.map(function (o) {
      var card = h('button', {
        className: 'card' + (state.audience === o.k ? ' selected' : ''),
        onClick: function () {
          state.audience = o.k;
          cards.forEach(function (c, i) {
            c.classList.toggle('selected', options[i].k === o.k);
            c.querySelector('.small-mono').textContent = options[i].k === o.k ? '● selected' : '○ select';
          });
        },
      },
        h('div', { className: 'card-row' },
          h('div', { className: 'card-title lg', textContent: o.title }),
          h('div', { className: 'small-mono', textContent: state.audience === o.k ? '● selected' : '○ select' })
        ),
        h('p', { className: 'small', style: { marginTop: '10px', lineHeight: '1.55' }, textContent: o.body })
      );
      return card;
    });

    var firstNameDisplay = state.firstName || 'You';
    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title' }, firstNameDisplay + ', who\'s paying you?'),
      h('p', { className: 'question-sub', textContent: "This single answer roughly doubles or halves your ceiling. Pick the one that describes most of your revenue today — or where you want it to come from." }),
      h('div', { className: 'card-grid-2' }, cards)
    );
    return shell;
  }

  function renderActivity() {
    var shell = buildStepShell({
      step: 3, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 3 · Your main activity',
      onNext: goNext, onBack: goBack,
      nextDisabled: !state.activity || (state.activity === 'Other' && !state.activityOther.trim()),
    });

    var otherInput = null;
    var cards = ACTIVITY_OPTIONS.map(function (opt) {
      var card = h('button', {
        className: 'card' + (state.activity === opt ? ' selected' : ''),
        onClick: function () {
          state.activity = opt;
          if (opt !== 'Other') state.activityOther = '';
          var valid = opt !== 'Other' || (otherInput && otherInput.value.trim());
          shell.querySelector('.btn-primary').disabled = !valid;
          cards.forEach(function (c, i) {
            c.classList.toggle('selected', ACTIVITY_OPTIONS[i] === opt);
          });
          if (otherInputWrap) {
            otherInputWrap.style.display = opt === 'Other' ? 'block' : 'none';
          }
        },
      }, h('div', { className: 'card-title', textContent: opt }));
      return card;
    });

    var otherInputWrap = h('div', {
      style: { marginTop: '24px', maxWidth: '480px', display: state.activity === 'Other' ? 'block' : 'none' },
    });
    otherInput = h('input', {
      type: 'text', className: 'text-input',
      placeholder: 'Tell me what it is',
      value: state.activityOther,
      autofocus: state.activity === 'Other',
      onInput: function () {
        state.activityOther = otherInput.value;
        shell.querySelector('.btn-primary').disabled = !otherInput.value.trim();
      },
      onKeydown: function (e) {
        if (e.key === 'Enter' && otherInput.value.trim()) goNext();
      },
    });
    otherInputWrap.appendChild(otherInput);

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title' },
        'What is the ',
        h('em', null, 'main'),
        ' kind of expertise you sell?'
      ),
      h('p', { className: 'question-sub', textContent: "Pick the one that makes the most money for you today — or the one you'd call yourself if a stranger asked. We'll ask about the others in a second." }),
      h('div', { className: 'card-grid-3' }, cards),
      otherInputWrap
    );
    return shell;
  }

  function renderActivitySecondary() {
    var mainActivity = state.activity === 'Other' ? (state.activityOther || 'Other') : state.activity;
    var options = ACTIVITY_OPTIONS.filter(function (o) { return o !== state.activity; });

    var shell = buildStepShell({
      step: 4, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 4 · The rest of the portfolio',
      onNext: goNext, onBack: goBack,
    });

    var cards = options.map(function (opt) {
      var sel = state.activitySecondary.indexOf(opt) > -1;
      var card = h('button', {
        className: 'card' + (sel ? ' selected' : ''),
        onClick: function () {
          var idx = state.activitySecondary.indexOf(opt);
          if (idx > -1) {
            state.activitySecondary.splice(idx, 1);
          } else {
            state.activitySecondary.push(opt);
          }
          var isSel = state.activitySecondary.indexOf(opt) > -1;
          card.classList.toggle('selected', isSel);
          card.querySelector('.small-mono').textContent = isSel ? '✓' : '+';
        },
      },
        h('div', { className: 'card-row' },
          h('div', { className: 'card-title', textContent: opt }),
          h('div', { className: 'small-mono', textContent: sel ? '✓' : '+' })
        )
      );
      return card;
    });

    var sub = h('p', { className: 'question-sub' },
      'Pick any that apply. Your main is ',
      h('strong', { textContent: mainActivity }),
      ' — these are the secondary offers, even small ones. Skip if there are none.'
    );

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: 'And what else do you sell, on the side?' }),
      sub,
      h('div', { className: 'card-grid-3' }, cards)
    );
    return shell;
  }

  function renderPlatforms() {
    var shell = buildStepShell({
      step: 5, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 5 · Your channels',
      onNext: goNext, onBack: goBack,
      nextDisabled: !ALL_PLATFORMS.some(function (m) { return state.platforms[m.key].active; }),
    });

    var cards = ALL_PLATFORMS.map(function (m) {
      var active = state.platforms[m.key].active;
      var kindLabel = m.kind === 'owned' ? 'owned audience' : m.kind === 'long' ? 'longer content' : 'short content';
      var card = h('button', {
        className: 'card' + (active ? ' selected' : ''),
        onClick: function () {
          state.platforms[m.key].active = !state.platforms[m.key].active;
          var anyActive = ALL_PLATFORMS.some(function (p) { return state.platforms[p.key].active; });
          shell.querySelector('.btn-primary').disabled = !anyActive;
          var isNowActive = state.platforms[m.key].active;
          card.classList.toggle('selected', isNowActive);
          card.querySelector('.small-mono').textContent = isNowActive ? '✓' : '+';
        },
      },
        h('div', { className: 'card-row' },
          h('div', { className: 'card-title', textContent: m.label }),
          h('div', { className: 'small-mono', textContent: active ? '✓' : '+' })
        ),
        h('div', { className: 'small-mono', style: { marginTop: '6px' }, textContent: kindLabel })
      );
      return card;
    });

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: 'Where do you already have an audience?' }),
      h('p', { className: 'question-sub', textContent: 'Tick every platform where you post — even sporadically. Skip the ones you don\'t use. Include your email newsletter if you have one.' }),
      h('div', { className: 'card-grid-3' }, cards)
    );
    return shell;
  }

  function renderFollowers() {
    var activePlatforms = ALL_PLATFORMS.filter(function (m) { return state.platforms[m.key].active; });

    var shell = buildStepShell({
      step: 6, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 6 · The numbers, honestly',
      onNext: goNext, onBack: goBack,
    });

    var rows = activePlatforms.map(function (m) {
      var kindLabel = m.kind === 'owned' ? 'owned audience' : m.kind === 'long' ? 'longer content' : 'short content';
      var input = h('input', {
        type: 'number', className: 'num-input',
        min: 0, placeholder: '0',
        value: state.platforms[m.key].followers || '',
        onInput: function () {
          state.platforms[m.key].followers = Math.max(0, parseInt(input.value || '0', 10));
        },
      });
      return h('div', { className: 'follower-row' },
        h('div', null,
          h('div', { className: 'card-title', textContent: m.label }),
          h('div', { className: 'small-mono', textContent: kindLabel })
        ),
        h('div', { className: 'follower-input-wrap' },
          input,
          h('span', { className: 'small', textContent: 'subscribers' })
        )
      );
    });

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: 'How many actual subscribers on each?' }),
      h('p', { className: 'question-sub' },
        'We want ',
        h('strong', null, 'subscribers'),
        ' — people who clicked "subscribe", "follow" or "sign up". Not your monthly views, not your reach. Round numbers are fine.'
      ),
      h('div', { style: { marginTop: '32px', maxWidth: '720px' } }, rows)
    );
    return shell;
  }

  function renderCadence() {
    var activeSocial = PLATFORM_META.filter(function (m) { return state.platforms[m.key].active; });
    var emailActive = state.platforms.email.active;

    var shell = buildStepShell({
      step: 7, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 7 · How often, really',
      onNext: goNext, onBack: goBack,
    });
    
    var socialRows = activeSocial.map(function (m) {
      var valueDisplay = h('div', { className: 'cadence-value' });
      function updateDisplay(v) {
        valueDisplay.textContent = '';
        append(valueDisplay, v + ' ');
        append(valueDisplay, h('span', { className: 'small', textContent: 'posts/week' }));
      }
      updateDisplay(state.platforms[m.key].freq);

      var slider = buildFreqSlider(state.platforms[m.key].freq, 7, function (v) {
        state.platforms[m.key].freq = v;
        updateDisplay(v);
      }, false);

      return h('div', { className: 'cadence-row' },
        h('div', null,
          h('div', { className: 'card-title', textContent: m.label }),
          h('div', { className: 'small-mono', textContent: 'subscribers · ' + fmtInt(state.platforms[m.key].followers || 0) })
        ),
        slider,
        valueDisplay
      );
    });

    var emailRow = null;
    if (emailActive) {
      var emailDisplay = h('div', { className: 'cadence-value' });
      var updateEmailDisplay = function (v) {
        emailDisplay.textContent = '';
        append(emailDisplay, (v === 31 ? '31+' : v) + ' ');
        append(emailDisplay, h('span', { className: 'small', textContent: 'emails/month' }));
      };
      updateEmailDisplay(state.platforms.email.freq);

      var emailSlider = buildFreqSlider(state.platforms.email.freq, 31, function (v) {
        state.platforms.email.freq = v;
        updateEmailDisplay(v);
      }, true);

      emailRow = h('div', { className: 'cadence-row' },
        h('div', null,
          h('div', { className: 'card-title', textContent: 'Email newsletter' }),
          h('div', { className: 'small-mono', textContent: 'subscribers · ' + fmtInt(state.platforms.email.followers || 0) })
        ),
        emailSlider,
        emailDisplay
      );
    }

    var cadenceContainer = h('div', { style: { marginTop: '32px', maxWidth: '820px' } });
    if (activeSocial.length > 0) {
      append(cadenceContainer,
        h('div', { className: 'eyebrow', style: { paddingBottom: '10px' }, textContent: 'Per week' }),
        socialRows
      );
    }
    if (emailActive) {
      append(cadenceContainer,
        h('div', { className: 'eyebrow', style: { paddingTop: '24px', paddingBottom: '10px' }, textContent: 'Per month' }),
        emailRow
      );
    }

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: 'How often do you actually publish?' }),
      h('p', { className: 'question-sub', textContent: "Be honest. Not the cadence you wish you had — the one you've sustained for the past month." }),
      cadenceContainer
    );
    return shell;
  }

  function renderHours() {
    var shell = buildStepShell({
      step: 8, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 8 · The hard constraint',
      onNext: goNext, onBack: goBack,
    });

    var bigNum = h('div', { style: { fontFamily: 'var(--serif)', fontSize: '88px', lineHeight: '0.9', letterSpacing: '-0.02em' } });
    function updateBigNum(v) {
      bigNum.textContent = '';
      append(bigNum, String(v));
      append(bigNum, h('span', { style: { fontSize: '30px', color: 'rgba(26,26,26,0.55)' }, textContent: 'h' }));
    }
    updateBigNum(state.hoursPerWeek);

    var slider = h('input', {
      type: 'range', min: 0, max: 20, step: 1, value: state.hoursPerWeek,
      onInput: function () {
        var v = parseInt(slider.value, 10);
        state.hoursPerWeek = v;
        updateBigNum(v);
      },
    });

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: 'How many hours a week do you have available for creating content?' }),
      h('p', { className: 'question-sub', textContent: 'Not aspirational hours. Real hours, after kids, clients, and life. This is the single number that caps everything else.' }),
      h('div', { style: { marginTop: '48px', maxWidth: '760px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' } },
          bigNum,
          h('div', { className: 'small-mono', style: { paddingBottom: '8px' }, textContent: 'per week' })
        ),
        slider,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '8px' }, className: 'small-mono' },
          h('span', { textContent: '0h · spectator' }),
          h('span', { textContent: '5h · committed' }),
          h('span', { textContent: '10h · serious' }),
          h('span', { textContent: '20h+' })
        )
      )
    );
    return shell;
  }

  function renderPrice() {
    var currency = state.currency || 'EUR';
    var shell = buildStepShell({
      step: 9, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 9 · Almost done!',
      onNext: goNext, onBack: goBack,
    });

    var lowDisplay = h('div', { style: { fontFamily: 'var(--serif)', fontSize: '44px', fontWeight: '400' } });
    var highDisplay = h('div', { style: { fontFamily: 'var(--serif)', fontSize: '44px', fontWeight: '400' } });

    function updateDisplays(lo, hi) {
      lowDisplay.textContent = fmtMoney(lo, currency);
      highDisplay.textContent = fmtMoney(hi, currency);
    }
    updateDisplays(state.priceLow, state.priceHigh);

    var dualRange = buildDualRange(state.priceLow, state.priceHigh, {
      min: 0, max: 25000, step: 50,
      onChange: function (lo, hi) {
        state.priceLow = lo;
        state.priceHigh = hi;
        updateDisplays(lo, hi);
      },
    });

    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title', textContent: "Almost done! What's the price range you sell at today?" }),
      h('p', { className: 'question-sub', textContent: "From your cheapest paid offer to your highest ticket. Use today's prices — not last year's, not next year's." }),
      h('div', { style: { marginTop: '48px', maxWidth: '760px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' } },
          h('div', null,
            h('div', { className: 'eyebrow', textContent: 'Lowest offer' }),
            lowDisplay
          ),
          h('div', { className: 'small-mono', style: { paddingBottom: '12px' }, textContent: '→' }),
          h('div', { style: { textAlign: 'right' } },
            h('div', { className: 'eyebrow', textContent: 'Highest ticket' }),
            highDisplay
          )
        ),
        dualRange,
        h('div', { className: 'price-labels' },
          h('span', { textContent: '€0' }),
          h('span', { textContent: '€2.5k' }),
          h('span', { textContent: '€5k' }),
          h('span', { textContent: '€10k' }),
          h('span', { textContent: '€25k' })
        )
      )
    );
    return shell;
  }

  function renderEmailGate() {
    var valid = /\S+@\S+\.\S+/.test(state.email);
    var shell = buildStepShell({
      step: 10, total: FORM_STEPS_TOTAL,
      eyebrow: 'Step 10 · Last question!',
      onNext: goNext, onBack: goBack,
      nextDisabled: !valid,
      nextLabel: editing ? undefined : 'Unlock my result →',
    });

    var input = h('input', {
      type: 'email', className: 'text-input',
      placeholder: 'you@yourdomain.com',
      value: state.email,
      autofocus: true,
      onInput: function () {
        state.email = input.value;
        var isValid = /\S+@\S+\.\S+/.test(state.email);
        shell.querySelector('.btn-primary').disabled = !isValid;
      },
      onKeydown: function (e) {
        if (e.key === 'Enter' && /\S+@\S+\.\S+/.test(state.email)) goNext();
      },
    });

    var name = state.firstName || 'you';
    var body = shell._body;
    append(body,
      h('h1', { className: 'question-title' },
        'Last question! Where should I send your result, ',
        h('span', { textContent: name }),
        '?'
      ),
      h('p', { className: 'question-sub', textContent: "So I can send you the next videos in the bootcamp, where I explain how to become a High-Value Expert." }),
      h('div', { style: { marginTop: '32px', maxWidth: '520px' } }, input)
    );
    return shell;
  }

  // ── Computing screen ──────────────────────────────────────────────────────
  function renderComputing() {
    var lines = [
      'Reading your inputs…',
      'Pulling benchmarks from the cohort…',
      'Computing audience trajectory…',
      'Applying B2B / B2C multiplier…',
      'Stress-testing against the 12-month ceiling…',
      'Done.',
    ];

    var lineEls = lines.map(function (l, i) {
      var icon = h('span', { className: 'small-mono', textContent: ' ' });
      var text = h('span', { className: 'small-mono', style: { color: '#1a1a1a' }, textContent: l });
      return h('div', { className: 'computing-line', style: { opacity: i === 0 ? '1' : '0.25' } },
        icon, text
      );
    });

    var wrap = h('div', { className: 'computing-wrap' },
      h('div', { className: 'eyebrow', textContent: 'Computing' }),
      h('div', { className: 'computing-title', textContent: 'Crunching your numbers.' }),
      h('div', { className: 'computing-lines' }, lineEls)
    );

    var phase = 0;
    submitToProxy(state); // fire-and-forget

    function tick() {
      if (phase < lines.length - 1) {
        phase++;
        lineEls[phase].style.opacity = '1';
        lineEls[phase - 1].querySelector('span').textContent = '✓';
        lineEls[phase].querySelector('span').textContent = '›';
        setTimeout(tick, 480);
      } else {
        lineEls[phase].querySelector('span').textContent = '✓';
        setTimeout(function () { goTo('result'); }, 800);
      }
    }

    lineEls[0].querySelector('span').textContent = '›';
    setTimeout(tick, 480);

    return wrap;
  }

  // ── Result page ───────────────────────────────────────────────────────────

  function buildResultLeft(s, proj) {
    var social = totalSocial(s);
    var freq = totalFreq(s);
    var activity = s.activity === 'Other' ? (s.activityOther || 'Other') : s.activity;
    var secondary = s.activitySecondary.length;

    function makeRow(n, label, valueText, editTarget) {
      var valEl = h('div', { className: 'r-row-value' });
      valEl.textContent = valueText;
      return h('div', { className: 'r-row' },
        h('div', { className: 'small-mono', textContent: pad2(n) }),
        h('div', null,
          h('div', { className: 'r-row-label', textContent: label }),
          valEl
        ),
        h('button', { className: 'pencil-btn', title: 'Edit ' + label.toLowerCase(), onClick: function () { onEdit(editTarget); } },
          buildPencilIcon(13)
        )
      );
    }

    var helloName = h('span', { textContent: s.firstName || 'there' });
    var hdr = h('div', null,
      h('div', { className: 'eyebrow', textContent: 'Revenue Calculator' }),
      h('div', { style: { fontFamily: 'var(--serif)', fontSize: '26px', marginTop: '8px', lineHeight: '1.15', fontWeight: '400' } },
        'Hello ', helloName, '.', h('br'), "Here's what you told us."
      ),
      h('div', { className: 'small', style: { marginTop: '8px', fontStyle: 'italic' } },
        'Click any ', buildPencilIcon(10), ' to edit an answer.'
      )
    );
    hdr.querySelector('.small').style.display = 'flex';
    hdr.querySelector('.small').style.alignItems = 'center';
    hdr.querySelector('.small').style.gap = '4px';

    var summary = h('div', { className: 'summary-box' },
      makeRow(1, 'Audience', s.audience + ' · ' + activity + (secondary ? ' (+' + secondary + ')' : ''), 'audience'),
      makeRow(2, 'Total social following', fmtInt(social) + ' people', 'platforms'),
      makeRow(3, 'Email subscribers', s.platforms.email.active ? fmtInt(s.platforms.email.followers || 0) : '— no list', 'followers'),
      makeRow(4, 'Posting cadence', fmtInt(freq) + ' posts/week', 'cadence'),
      makeRow(5, 'Hours / week available', s.hoursPerWeek + 'h', 'hours'),
      makeRow(6, 'Price range', fmtMoney(s.priceLow || 0, 'EUR') + ' – ' + fmtMoney(s.priceHigh || 0, 'EUR'), 'price')
    );

    var today = new Date();
    var sessionId = '7f-' + today.toISOString().slice(0, 10) + '-' + (s.firstName || 'anon').toLowerCase().slice(0, 3);
    var meta = h('div', { className: 'session-meta' },
      h('div', { textContent: 'session_id · ' + sessionId }),
      h('div', { textContent: 'computed · ' + today.toISOString().slice(0, 10) }),
      h('div', { textContent: 'model · ROCC v3.1 · onetake.ai' })
    );

    var restartBtn = h('button', { className: 'btn-restart', onClick: restart, textContent: '↺ Restart from scratch' });
    
    return h('div', { className: 'result-left' }, hdr, summary, meta, restartBtn);
  }

  function buildResultRight(s, proj, currency) {
    // Header
    var header = h('div', null,
      h('div', { className: 'result-header-top' },
        h('div', null,
          h('div', { className: 'eyebrow' },
            'Audit · prepared for ',
            h('span', { textContent: s.firstName || 'you' })
          ),
          h('div', { className: 'small', style: { marginTop: '4px' } },
            'Confidential · ' +
            new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
            ' · Issued by Sébastien Night · OneTake AI'
          )
        ),
        buildCurrencyToggle(currency, function (c) {
          state.currency = c;
          render();
        })
      ),
      h('div', { className: 'hairline', style: { marginTop: '22px' } })
    );

    // Hero
    var heroAmtEl = h('em', { style: { fontStyle: 'italic', color: '#9c4a1c' } }, '—');
    var heroAmtSuffix = h('span', { style: { fontSize: '0.6em', fontStyle: 'normal', color: '#9c4a1c' }, textContent: '/mo' });
    var personalEl = h('strong', null, '—/month');

    var hero = h('div', { className: 'r-hero' },
      h('div', null,
        h('div', { className: 'eyebrow', textContent: 'Headline finding' }),
        h('h1', { className: 'r-hero-headline' },
          'Twelve months from today, your expert business should be running at ',
          heroAmtEl, heroAmtSuffix,
          ' in revenue.'
        ),
        h('p', { className: 'r-hero-sub' },
          'That puts roughly ', personalEl,
          ' in your pocket, after the usual cost-of-doing-business and tax overhead. You\'re not there today — but the inputs on the left show this is the realistic ceiling of a system you can run in the hours you already have.'
        )
      ),
      h('aside', { className: 'at-a-glance' },
        h('div', { className: 'ag-eyebrow', textContent: 'At a glance' }),
        h('div', { style: { marginTop: '16px' } },
          buildAgRow('Today', fmtMoney(proj.currentMonthlyRevenue, currency) + '/mo', false),
          buildAgRow('In 12 months', fmtMoney(proj.targetMonthlyRevenue, currency) + '/mo', true),
          buildAgRow('Annual run-rate', fmtMoney(proj.annualRevenue, currency), false),
          buildAgRow('Take-home (40%)', fmtMoney(proj.targetPersonalIncome, currency) + '/mo', false)
        )
      )
    );

    // Charts
    var audienceChart = buildAudienceChart(s, proj);
    var revenueChart = buildRevenueChartEl(proj, currency);
    var charts = h('div', { className: 'charts-grid' }, audienceChart, revenueChart);

    // Diagnostic
    var issues = diagnose(s, proj);
    var diagnostic = buildDiagnostic(issues);

    // Footer
    var footer = buildResultFooter();

    var right = h('div', { className: 'result-right' },
      header, hero,
      h('div', { className: 'hairline-light' }),
      charts,
      h('div', { className: 'hairline-light' }),
      diagnostic,
      footer
    );

    // Schedule count-up animations
    setTimeout(function () {
      countUp(heroAmtEl, proj.targetMonthlyRevenue, function (v) { return fmtMoney(v, currency) ; }, 1800);
      countUp(personalEl, proj.targetPersonalIncome, function (v) { return fmtMoney(v, currency) + '/month'; }, 2000);
    }, 80);

    return right;
  }

  function buildAgRow(label, value, bold) {
    return h('div', { className: 'ag-row' },
      h('span', { className: 'ag-row-label', textContent: label }),
      h('span', { className: 'ag-row-value' + (bold ? ' bold' : ''), textContent: value })
    );
  }

  function buildAudienceChart(s, proj) {
    var W = 460, H = 200;
    var active = activePlatformsList(s);

    var allVals = active.reduce(function (acc, m) {
      return acc.concat(proj.platformSeries[m.key]);
    }, []);
    if (s.platforms.email.active) allVals = allVals.concat(proj.emailSeries);
    var scaleMax = Math.max.apply(null, allVals.concat([1]));

    var startTotal = active.reduce(function (a, m) { return a + proj.platformSeries[m.key][0]; }, 0) +
      (s.platforms.email.active ? proj.emailSeries[0] : 0);
    var endTotal = active.reduce(function (a, m) { return a + proj.platformSeries[m.key][12]; }, 0) +
      (s.platforms.email.active ? proj.emailSeries[12] : 0);

    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', style: 'display:block;width:100%;overflow:visible' });
    svg.appendChild(buildGridlines(W, H));

    // Platform lines
    active.forEach(function (m) {
      var d = buildSparklinePath(proj.platformSeries[m.key], W, H, scaleMax);
      var path = svgEl('path', {
        d: d, fill: 'none', stroke: m.color,
        'stroke-width': '1.5', 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      });
      svg.appendChild(path);
    });

    // Email line (thick, dark)
    if (s.platforms.email.active) {
      var d = buildSparklinePath(proj.emailSeries, W, H, scaleMax);
      var path = svgEl('path', {
        d: d, fill: 'none', stroke: '#1a1a1a',
        'stroke-width': '2.4', 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      });
      svg.appendChild(path);
    }

    // Legend
    var legendItems = [];
    if (s.platforms.email.active) {
      legendItems.push(h('div', { className: 'legend-item' },
        h('span', { className: 'legend-swatch', style: { background: '#1a1a1a', height: '2.4px' } }),
        h('span', null,
          h('strong', { textContent: 'Email list' }),
          ' · ' + fmtInt(proj.emailSeries[0]) + ' → ' + fmtInt(proj.emailSeries[12])
        )
      ));
    }
    active.forEach(function (m) {
      legendItems.push(h('div', { className: 'legend-item' },
        h('span', { className: 'legend-swatch', style: { background: m.color } }),
        h('span', { textContent: m.label + ' · ' + fmtInt(proj.platformSeries[m.key][0]) + ' → ' + fmtInt(proj.platformSeries[m.key][12]) })
      ));
    });

    return h('figure', { className: 'chart-figure' },
      h('figcaption', { className: 'chart-figcaption' },
        h('div', null,
          h('div', { className: 'eyebrow', textContent: 'Exhibit 1 — Audience trajectory, by platform' }),
          h('div', { className: 'chart-big' },
            fmtInt(startTotal) + ' ',
            h('span', { className: 'small', textContent: '→' }),
            ' ' + fmtInt(endTotal)
          )
        ),
        h('div', { className: 'chart-range-label', textContent: '0 → 12 mo' })
      ),
      h('div', { className: 'chart-wrap' },
        svg,
        h('div', { className: 'chart-axis' },
          h('span', { textContent: 'Mo 0' }),
          h('span', { textContent: 'Mo 3' }),
          h('span', { textContent: 'Mo 6' }),
          h('span', { textContent: 'Mo 9' }),
          h('span', { textContent: 'Mo 12' })
        )
      ),
      h('div', { className: 'chart-legend' }, legendItems),
      h('p', { className: 'small', style: { marginTop: '10px', lineHeight: '1.55' } },
        'Each platform grows at the same rate, set by your weekly time investment (' +
        s.hoursPerWeek + 'h/week → ',
        h('strong', { textContent: Math.round(proj.monthlyGrowth * 100) + '%/month' }),
        ' per platform).'
      )
    );
  }

  function buildRevenueChartEl(proj, currency) {
    var W = 460, H = 200;
    var values = proj.revenue.map(function (d) { return d.revenue; });
    var scaleMax = Math.max.apply(null, values.concat([1]));

    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', style: 'display:block;width:100%;overflow:visible' });
    svg.appendChild(buildGridlines(W, H));

    var linePath = buildSparklinePath(values, W, H, scaleMax);

    var fill = svgEl('path', {
      d: linePath + ' L' + W + ',' + H + ' L0,' + H + ' Z',
      fill: 'rgba(156,74,28,0.12)', stroke: 'none',
    });
    var line = svgEl('path', {
      d: linePath, fill: 'none', stroke: '#1a1a1a',
      'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    });
    svg.appendChild(fill);
    svg.appendChild(line);

    var today = values[0], target = values[values.length - 1];

    return h('figure', { className: 'chart-figure' },
      h('figcaption', { className: 'chart-figcaption' },
        h('div', null,
          h('div', { className: 'eyebrow', textContent: 'Exhibit 2 — Monthly revenue trajectory' }),
          h('div', { className: 'chart-big' },
            fmtMoney(today, currency) + ' ',
            h('span', { className: 'small', textContent: '→' }),
            ' ' + fmtMoney(target, currency)
          )
        ),
        h('div', { className: 'chart-range-label', textContent: '0 → 12 mo' })
      ),
      h('div', { className: 'chart-wrap' },
        svg,
        h('div', { className: 'chart-axis' },
          h('span', { textContent: 'Mo 0' }),
          h('span', { textContent: 'Mo 3' }),
          h('span', { textContent: 'Mo 6' }),
          h('span', { textContent: 'Mo 9' }),
          h('span', { textContent: 'Mo 12' })
        )
      ),
      h('p', { className: 'small', style: { marginTop: '10px', lineHeight: '1.55' } },
        'Run-rate assumes 1 engaged email subscriber → 1 unit/mo',
        proj.b2bMult > 1 ? ', ×' + proj.b2bMult + ' for B2B mix.' : '.'
      )
    );
  }

  function buildDiagnostic(issues) {
    var shown = issues.slice(0, 3);
    var countLabel = shown.length === 1 ? 'One resource is' : (shown.length + ' resources are');

    var items = shown.map(function (it, i) {
      return h('li', { className: 'diagnostic-item' },
        h('div', { className: 'diagnostic-num', textContent: pad2(i + 1) }),
        h('div', null,
          h('div', { className: 'diagnostic-headline', textContent: it.headline }),
          h('p', { className: 'diagnostic-body', textContent: it.body })
        ),
        h('div', { className: 'lever-box' },
          h('div', { className: 'lever-label', textContent: 'The lever' }),
          h('div', { className: 'lever-text', textContent: it.lever })
        )
      );
    });

    return h('section', null,
      h('div', { className: 'eyebrow diagnostic-eyebrow', textContent: 'Diagnostic — where you are leaving money on the table' }),
      h('div', { className: 'diagnostic-title' },
        'Your expertise isn\'t the problem. ' + countLabel + ' sitting idle.'
      ),
      h('ol', { className: 'diagnostic-list' }, items)
    );
  }

  function buildResultFooter() {
    var legalHtml = '<p>By signing up, I agree to the <a ="https://www.onetake.ai/terms-of-service" target="_blank">Terms of Service &amp; Refund Policy</a> and the <a ="https://www.onetake.ai/privacy-policy" target="_blank">Privacy Policy</a>.</p>'
      + '<p><strong>What is OneTake?</strong></p>'
      + '<p><strong>OneTake AI turns raw videos into professional presentations.</strong> To help experts, trainers, coaches and authors create and publish their video content, we\'ve created <a ="https://www.onetake.ai" target="_blank">OneTake AI, the first all-in-one video editing software powered by artificial intelligence</a>.</p>'
      + '<p>Useful links: <a ="https://www.onetake.ai/blog" target="_blank">OneTake\'s Blog</a> · <a ="https://welove.onetake.ai/" target="_blank">Wall of Love (reviews)</a> · <a ="https://docs.onetake.ai/en/" target="_blank">FAQ &amp; Docs</a></p>'
      + '<p><strong>Who came up with the idea?</strong></p>'
      + '<p>Sébastien Night, our CEO, is the founder of the Free Entrepreneurs Movement — an organization supporting over 20,000 entrepreneur clients and 300,000 supporters in 41 countries since 2010. <strong>After producing and editing thousands of videos himself over 15+ years, Sébastien decided to create a tool that would be both incredibly powerful and utterly easy to use: OneTake.</strong></p>'
      + '<p><span>To contact Sébastien and his team,</span> <a ="https://www.onetake.ai/contact" target="_blank">simply click here</a></p>';

    return h('footer', null,
      h('div', { className: 'footer-cta' },
        h('div', { className: 'footer-cta-text' },
          h('div', { className: 'eyebrow', textContent: 'Next step' }),
          h('h3', { textContent: 'Now go share your results in the comments under Video 1.' }),
          h('p', { textContent: 'Tell me what you found. I read every comment, and Video 2 will show you exactly which of the five pillars to start with — given your specific projections.' })
        ),
        h('a', {
          href: 'https://try.onetake.ai/bootcamps/ehv/vpl1-10k/#comment-questions',
          className: 'footer-cta-btn',
          textContent: 'Share my result →',
        })
      ),
      h('p', { className: 'disclaimer', textContent: 'Disclaimer — This is not a revenue promise. The figures above are a benchmark drawn from the cohort of experts selling infoproducts and high-touch programs in Sébastien Night\'s network. Your actual results depend on execution, market, and offer.' }),
      h('div', { className: 'legal-footer', innerHTML: legalHtml })
    );
  }

  function renderResult() {
    var proj = computeProjection(state);
    var currency = state.currency || 'EUR';

    var left = buildResultLeft(state, proj);
    var right = buildResultRight(state, proj, currency);

    return h('div', { className: 'result-grid' }, left, right);
  }

  // ── Proxy call ────────────────────────────────────────────────────────────
  function submitToProxy(s) {
    try {
      var proj = computeProjection(s);
      fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ViewContent',
          user: { email: s.email },
          properties: {
            url: 'https://contraband.onetake.ai/ehv/revenue-calc/',
            first_name: s.firstName,
            audience: s.audience,
            activity: s.activity,
            activity_other: s.activityOther,
            activity_secondary: s.activitySecondary,
            hours_per_week: s.hoursPerWeek,
            price_low: s.priceLow,
            price_high: s.priceHigh,
            email_subscribers: s.platforms.email.active ? (s.platforms.email.followers || 0) : 0,
            total_social_following: totalSocial(s),
            projected_annual_revenue_eur: proj.annualRevenue,
            projected_monthly_revenue_eur: proj.targetMonthlyRevenue,
            projected_personal_income_eur: proj.targetPersonalIncome,
            active_platforms: activePlatformsList(s).map(function (m) { return m.key; }),
          },
        }),
      }).catch(function () { /* silent */ });
    } catch (e) { /* silent */ }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '';

    var cur = STEPS[stepIdx];
    var node;

    switch (cur) {
      case 'name':               node = renderName(); break;
      case 'audience':           node = renderAudience(); break;
      case 'activity':           node = renderActivity(); break;
      case 'activitySecondary':  node = renderActivitySecondary(); break;
      case 'platforms':          node = renderPlatforms(); break;
      case 'followers':          node = renderFollowers(); break;
      case 'cadence':            node = renderCadence(); break;
      case 'hours':              node = renderHours(); break;
      case 'price':              node = renderPrice(); break;
      case 'email':              node = renderEmailGate(); break;
      case 'computing':          node = renderComputing(); break;
      case 'result':             node = renderResult(); break;
      default:                   node = renderName();
    }

    if (node) {
      app.appendChild(node);
      var af = app.querySelector('[autofocus]');
      if (af) setTimeout(function () { af.focus(); }, 50);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    render();
  });

})();
