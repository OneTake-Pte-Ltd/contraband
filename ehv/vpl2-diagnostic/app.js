(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────
  var PROXY = 'https://claude-proxy-ehv-vpl2-diagnosis-okrhi.bunny.run';
  var SHARE_URL = 'https://try.onetake.ai/bootcamps/ehv/vpl2-diagnostic/#comment-questions';
  var SUPPORTED_LANGS = ['FR', 'EN', 'IT', 'ES', 'PT', 'JA'];

  // ── Questions ──────────────────────────────────────────────
  var QUESTIONS = [
    // Context
    {
      id: 'C1', kind: 'text', section: 'About you', label: '01',
      prompt: "What's your area of expertise?",
      hint: 'e.g. leadership coaching, naturopathy, HR consulting…',
      placeholder: 'Type a few words',
    },
    {
      id: 'C2', kind: 'choice', section: 'About you', label: '02',
      prompt: "What's your current monthly revenue from your expertise?",
      options: [
        { value: 'rev_0', label: '€0' },
        { value: 'rev_lt1k', label: 'Less than €1,000' },
        { value: 'rev_1k3k', label: '€1,000 – €3,000' },
        { value: 'rev_3k5k', label: '€3,000 – €5,000' },
        { value: 'rev_5k10k', label: '€5,000 – €10,000' },
        { value: 'rev_gt10k', label: 'More than €10,000' },
      ],
    },
    {
      id: 'C3', kind: 'choice', section: 'About you', label: '03',
      prompt: 'Who do you mainly sell your services to?',
      options: [
        { value: 'b2c', label: 'Individuals (B2C)' },
        { value: 'b2b', label: 'Businesses & professionals (B2B)' },
        { value: 'both', label: 'Both' },
      ],
    },
    // Pillar 1
    {
      id: 'P1_1', kind: 'choice', section: 'Pillar 1 · Positioning', pillar: 1, label: '04',
      prompt: 'Can you describe what you do — and for whom — in one well-rehearsed sentence, without hesitating?',
      options: [
        { value: 3, label: 'Yes, every time' },
        { value: 1, label: 'Roughly — I rephrase every time' },
        { value: 0, label: "No, I struggle to explain it simply" },
      ],
    },
    {
      id: 'P1_2', kind: 'choice', section: 'Pillar 1 · Positioning', pillar: 1, label: '05',
      prompt: 'Have you registered a trademark for your proprietary method — and do you actively use it in your marketing?',
      sub: 'Your method itself, not your company name.',
      options: [
        { value: 3, label: 'Yes, I have a named method I use in my marketing' },
        { value: 1, label: "I'm working on it" },
        { value: 0, label: "No, I don't have a named method" },
      ],
    },
    {
      id: 'P1_3', kind: 'choice', section: 'Pillar 1 · Positioning', pillar: 1, label: '06',
      prompt: 'When you describe your work, do people spontaneously react with "that\'s exactly what I need" or "I know someone with that problem"?',
      options: [
        { value: 3, label: 'Often' },
        { value: 1, label: 'Sometimes' },
        { value: 0, label: 'Rarely or never' },
      ],
    },
    // Pillar 2
    {
      id: 'P2_1', kind: 'choice', section: 'Pillar 2 · Irresistible Offer', pillar: 2, label: '07',
      prompt: 'Do you have a packaged offer at a fixed price you can quote without building a custom proposal each time?',
      options: [
        { value: 3, label: 'Yes' },
        { value: 0, label: 'No — I adapt my prices case by case' },
      ],
    },
    {
      id: 'P2_2', kind: 'choice', section: 'Pillar 2 · Irresistible Offer', pillar: 2, label: '08',
      prompt: "What's the price of your highest-tier offer?",
      conditional: true,
      variants: {
        b2c: [
          { value: 0, label: 'Less than €500' },
          { value: 1, label: '€500 – €1,000' },
          { value: 2, label: '€1,000 – €2,000' },
          { value: 3, label: '€2,000 – €5,000' },
          { value: 3, label: 'More than €5,000' },
        ],
        b2b: [
          { value: 0, label: 'Less than €500' },
          { value: 1, label: '€500 – €2,000' },
          { value: 2, label: '€2,000 – €5,000' },
          { value: 3, label: '€5,000 – €15,000' },
          { value: 3, label: 'More than €15,000' },
        ],
      },
    },
    {
      id: 'P2_3', kind: 'choice', section: 'Pillar 2 · Irresistible Offer', pillar: 2, label: '09',
      prompt: 'In the last 3 months, how many clients have bought this offer?',
      options: [
        { value: 0, label: 'None' },
        { value: 1, label: '1 to 3' },
        { value: 3, label: '4 or more' },
      ],
    },
    // Pillar 3
    {
      id: 'P3_1', kind: 'choice', section: 'Pillar 3 · Audience & Visibility', pillar: 3, label: '10',
      prompt: 'Do you publish content regularly — at least once a week — on one or more platforms?',
      options: [
        { value: 2, label: 'Yes, regularly' },
        { value: 1, label: "From time to time, not systematically" },
        { value: 0, label: 'No' },
      ],
    },
    {
      id: 'P3_2', kind: 'choice', section: 'Pillar 3 · Audience & Visibility', pillar: 3, label: '11',
      prompt: 'Do you have an email list?',
      options: [
        { value: 3, label: 'Yes, active' },
        { value: 1, label: 'Yes, but dormant' },
        { value: 0, label: 'No' },
      ],
    },
    {
      id: 'P3_3', kind: 'choice', section: 'Pillar 3 · Audience & Visibility', pillar: 3, label: '12',
      prompt: 'Does your content generate weekly inbound enquiries from people interested in your services?',
      options: [
        { value: 3, label: 'Yes, regularly' },
        { value: 1, label: 'No — I rely mostly on word of mouth' },
        { value: 0, label: "I don't publish enough to know" },
      ],
    },
    // Pillar 4
    {
      id: 'P4_1', kind: 'choice', section: 'Pillar 4 · Sales Machine', pillar: 4, label: '13',
      prompt: 'Do you have an automated sales funnel in place — lead magnet → email sequence → sales page?',
      options: [
        { value: 3, label: "Yes, and it converts clients" },
        { value: 1, label: "Yes, but it doesn't generate sales" },
        { value: 0, label: 'No' },
      ],
    },
    {
      id: 'P4_2', kind: 'choice', section: 'Pillar 4 · Sales Machine', pillar: 4, label: '14',
      prompt: "Do sales sometimes happen when you're not actively prospecting?",
      options: [
        { value: 3, label: 'Yes, regularly' },
        { value: 1, label: 'Occasionally' },
        { value: 0, label: 'No — every sale needs active outreach from me' },
      ],
    },
    // Pillar 5
    {
      id: 'P5_1', kind: 'choice', section: 'Pillar 5 · Notoriety', pillar: 5, label: '15',
      prompt: 'Do you have a ready-to-use bio that partners or other market leaders can use to introduce you to their audience?',
      options: [
        { value: 3, label: 'Yes, partners actively use it' },
        { value: 0, label: "Not yet — I have no partners recommending me" },
        { value: 0, label: "I'm not at that stage yet" },
      ],
    },
    {
      id: 'P5_2', kind: 'choice', section: 'Pillar 5 · Notoriety', pillar: 5, label: '16',
      prompt: 'Do partners, podcasters, event organisers or other experts reach out spontaneously to collaborate with you?',
      options: [
        { value: 3, label: 'Yes, regularly' },
        { value: 1, label: 'Sometimes' },
        { value: 0, label: 'No — I have to chase those opportunities myself' },
      ],
    },
    {
      id: 'P5_3', kind: 'choice', section: 'Pillar 5 · Notoriety', pillar: 5, label: '17',
      prompt: 'Have you run paid advertising that was profitable?',
      options: [
        { value: 3, label: 'Yes' },
        { value: 1, label: "I've tried but it wasn't profitable" },
        { value: 0, label: 'Not yet' },
      ],
    },
  ];

  var PILLAR_MAX = { 1: 9, 2: 9, 3: 8, 4: 6, 5: 9 };
  var PILLAR_NAMES = {
    1: 'Positioning',
    2: 'Irresistible Offer',
    3: 'Audience & Visibility',
    4: 'Sales Machine',
    5: 'Notoriety',
  };
  var PILLAR_FULL_NAMES = {
    1: 'Positioning of a Unique Mechanism',
    2: 'Irresistible Offer',
    3: 'Audience & Visibility',
    4: 'Sales Machine',
    5: 'Notoriety',
  };

  var NARRATION_STEPS = [
    { eyebrow: 'STEP 1 of 5', text: 'Reading your positioning…' },
    { eyebrow: 'STEP 2 of 5', text: 'Weighing your offer architecture…' },
    { eyebrow: 'STEP 3 of 5', text: 'Examining your audience system…' },
    { eyebrow: 'STEP 4 of 5', text: 'Inspecting your sales machine…' },
    { eyebrow: 'STEP 5 of 5', text: 'Identifying your bottleneck.' },
  ];

  // ── State ──────────────────────────────────────────────────
  var state = {
    phase: 'landing',
    language: detectLang(),
    qIndex: 0,
    answers: {},
    scores: null,
    bottleneck: null,
    diagnosis: null,
    diagnosisError: false,
    email: '',
    copied: false,
  };

  // ── Persistence ────────────────────────────────────────────
  function save() {
    try {
      sessionStorage.setItem('diag_v1', JSON.stringify({
        phase: state.phase === 'loading' ? 'gate' : state.phase,
        language: state.language,
        qIndex: state.qIndex,
        answers: state.answers,
        email: state.email,
        scores: state.scores,
        bottleneck: state.bottleneck,
        diagnosis: state.diagnosis,
        diagnosisError: state.diagnosisError,
      }));
    } catch (e) {}
  }

  function restore() {
    try {
      var saved = sessionStorage.getItem('diag_v1');
      if (!saved) return;
      var d = JSON.parse(saved);
      if (d.answers) state.answers = d.answers;
      if (d.qIndex !== undefined) state.qIndex = d.qIndex;
      if (d.phase) state.phase = d.phase;
      if (d.language) state.language = d.language;
      if (d.email) state.email = d.email;
      if (d.scores) state.scores = d.scores;
      if (d.bottleneck) state.bottleneck = d.bottleneck;
      if (d.diagnosis) state.diagnosis = d.diagnosis;
      if (d.diagnosisError !== undefined) state.diagnosisError = d.diagnosisError;
    } catch (e) {}
  }

  // ── Language detection ─────────────────────────────────────
  function detectLang() {
    var lang = ((navigator.language || navigator.userLanguage || 'en')).toUpperCase().slice(0, 2);
    return SUPPORTED_LANGS.indexOf(lang) !== -1 ? lang : 'EN';
  }

  // ── Scoring ────────────────────────────────────────────────
  function getAnswerValue(qid) {
    var ans = state.answers[qid];
    if (ans === undefined || ans === null) return 0;
    if (typeof ans === 'string') return 0; // text field
    if (typeof ans === 'object' && 'value' in ans) return Number(ans.value) || 0;
    return Number(ans) || 0;
  }

  function getAnswerLabel(qid) {
    var ans = state.answers[qid];
    if (!ans) return '';
    if (typeof ans === 'string') return ans;
    if (typeof ans === 'object' && 'label' in ans) return ans.label;
    return String(ans);
  }

  function isB2B() {
    var ans = state.answers['C3'];
    if (!ans) return false;
    var v = typeof ans === 'object' ? ans.value : ans;
    return v === 'b2b';
  }

  function scorePillar(pillar) {
    var raw = 0;
    QUESTIONS.forEach(function (q) {
      if (q.pillar !== pillar) return;
      raw += getAnswerValue(q.id);
    });
    var max = PILLAR_MAX[pillar];
    var pct = max > 0 ? Math.round((raw / max) * 100) : 0;
    return { raw: raw, max: max, pct: pct };
  }

  function computeScores() {
    var s = {};
    for (var p = 1; p <= 5; p++) s[p] = scorePillar(p);
    return s;
  }

  function identifyBottleneck(scores) {
    for (var p = 1; p <= 5; p++) {
      if (scores[p].pct < 50) return p;
    }
    var lowest = 1, lowestPct = 101;
    for (var p = 1; p <= 5; p++) {
      if (scores[p].pct < lowestPct) {
        lowest = p;
        lowestPct = scores[p].pct;
      }
    }
    return lowest;
  }

  // ── Utilities ──────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nlToParagraphs(text) {
    if (!text) return '';
    return text.split('\n\n').map(function (p) {
      return '<p>' + esc(p.trim()) + '</p>';
    }).join('');
  }

  function getP2_2Options() {
    return isB2B() ? QUESTIONS[7].variants.b2b : QUESTIONS[7].variants.b2c;
  }

  function getQuestionOptions(q) {
    if (q.conditional && q.variants) return getP2_2Options();
    return q.options;
  }

  function isAnswered(qid) {
    var q = QUESTIONS.find(function (q) { return q.id === qid; });
    if (!q) return false;
    var ans = state.answers[qid];
    if (ans === undefined || ans === null) return false;
    if (q.kind === 'text') return typeof ans === 'string' && ans.trim().length > 0;
    return true;
  }

  // ── SVG helpers ────────────────────────────────────────────
  function logoMark(size) {
    size = size || 24;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" style="display:block">'
      + '<rect x="0" y="0" width="32" height="32" rx="7" fill="#1a1714"/>'
      + '<path d="M9 11 L16 9 L23 11 L23 21 L16 23 L9 21 Z" fill="none" stroke="#E3AE28" stroke-width="1.4" stroke-linejoin="round"/>'
      + '<circle cx="16" cy="16" r="2.6" fill="#E3AE28"/>'
      + '</svg>';
  }

  function arrowRight() {
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">'
      + '<path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>';
  }

  function chevronLeft() {
    return '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
      + '<path d="M7 1L3 5l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>';
  }

  function checkIcon() {
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">'
      + '<path d="M2 7l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>';
  }

  function copyIcon() {
    return '<svg width="13" height="13" viewBox="0 0 13 13" fill="none">'
      + '<rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/>'
      + '<rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/>'
      + '</svg>';
  }

  function retakeIcon() {
    return '<svg width="13" height="13" viewBox="0 0 13 13" fill="none">'
      + '<path d="M11 6.5a4.5 4.5 0 1 1-1.3-3.2M11 1.5v3h-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>';
  }

  // ── Pentagon chart ─────────────────────────────────────────
  function renderPentagon(scores, bottleneck) {
    var size = Math.min(window.innerWidth - 44, 300);
    var cx = size / 2;
    var cy = size / 2 + 4;
    var R = size * 0.34;

    function angleFor(i) { return -Math.PI / 2 + (i * 2 * Math.PI) / 5; }
    function pt(i, r) {
      var a = angleFor(i);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }

    var labels = ['Positioning', 'Offer', 'Audience', 'Sales Machine', 'Notoriety'];

    // Concentric grids
    var grids = [0.25, 0.5, 0.75, 1].map(function (f, gi) {
      var pts = [0, 1, 2, 3, 4].map(function (i) {
        var p = pt(i, R * f);
        return p[0].toFixed(2) + ',' + p[1].toFixed(2);
      }).join(' ');
      var dash = gi < 3 ? 'stroke-dasharray="2 3"' : '';
      return '<polygon points="' + pts + '" fill="none" stroke="rgba(26,23,20,0.12)" stroke-width="0.5" ' + dash + '/>';
    }).join('');

    // 50% threshold
    var threshPts = [0, 1, 2, 3, 4].map(function (i) {
      var p = pt(i, R * 0.5);
      return p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }).join(' ');
    var threshold = '<polygon points="' + threshPts + '" fill="none" stroke="rgba(227,174,40,0.45)" stroke-width="0.8" stroke-dasharray="1 4"/>';

    // Axis lines
    var axes = [0, 1, 2, 3, 4].map(function (i) {
      var p = pt(i, R);
      return '<line x1="' + cx.toFixed(2) + '" y1="' + cy.toFixed(2) + '" x2="' + p[0].toFixed(2) + '" y2="' + p[1].toFixed(2) + '" stroke="rgba(26,23,20,0.1)" stroke-width="0.5"/>';
    }).join('');

    // Data polygon
    var dataPts = [1, 2, 3, 4, 5].map(function (p, i) {
      var pct = scores[p] ? scores[p].pct : 0;
      return pt(i, (R * pct) / 100);
    });
    var dataPath = dataPts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');

    // Vertex dots
    var dots = dataPts.map(function (p, i) {
      var isB = (i + 1) === bottleneck;
      var r = isB ? 5 : 3.5;
      var fill = isB ? '#1a1714' : '#E3AE28';
      var stroke = isB ? '#E3AE28' : '#1a1714';
      var sw = isB ? 1.5 : 0.8;
      var halo = isB ? '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="9" fill="rgba(26,23,20,0.08)"/>' : '';
      return halo + '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }).join('');

    // Labels
    var labelR = R + 22;
    var labelEls = [0, 1, 2, 3, 4].map(function (i) {
      var lp = pt(i, labelR);
      var isB = (i + 1) === bottleneck;
      var pct = scores[i + 1] ? scores[i + 1].pct : 0;
      var a = angleFor(i);
      var anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      var labelColor = isB ? '#1a1714' : '#5a534a';
      var numColor = isB ? '#b8881a' : '#1a1714';
      var fw = isB ? '600' : '400';
      return '<text x="' + lp[0].toFixed(2) + '" y="' + (lp[1] - 3).toFixed(2) + '" text-anchor="' + anchor + '"'
        + ' style="font-family:\'JetBrains Mono\',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;fill:' + labelColor + ';font-weight:' + fw + '">'
        + esc(labels[i]) + '</text>'
        + '<text x="' + lp[0].toFixed(2) + '" y="' + (lp[1] + 10).toFixed(2) + '" text-anchor="' + anchor + '"'
        + ' style="font-family:\'Instrument Serif\',serif;font-size:18px;fill:' + numColor + ';font-style:italic">'
        + pct + '</text>';
    }).join('');

    var svgH = size + 20;
    return '<svg width="' + size + '" height="' + svgH + '" viewBox="0 0 ' + size + ' ' + svgH + '" style="overflow:visible">'
      + '<defs>'
      + '<linearGradient id="dfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E3AE28" stop-opacity="0.32"/><stop offset="100%" stop-color="#E3AE28" stop-opacity="0.14"/></linearGradient>'
      + '<radialGradient id="cglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#E3AE28" stop-opacity="0.18"/><stop offset="100%" stop-color="#E3AE28" stop-opacity="0"/></radialGradient>'
      + '</defs>'
      + grids + threshold + axes
      + '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + R.toFixed(2) + '" fill="url(#cglow)"/>'
      + '<polygon points="' + dataPath + '" fill="url(#dfill)" stroke="#E3AE28" stroke-width="1.5" stroke-linejoin="round"/>'
      + dots + labelEls
      + '</svg>';
  }

  // ── Loading animation state ────────────────────────────────
  var loadingTimer = null;
  var loadingStep = 0;
  var loadingActive = false;

  function startLoadingAnimation() {
    loadingStep = 0;
    loadingActive = true;
    updateLoadingStep();
    loadingTimer = setInterval(function () {
      if (!loadingActive) return;
      if (loadingStep < NARRATION_STEPS.length - 1) {
        loadingStep++;
        updateLoadingStep();
      }
    }, 1450);
  }

  function stopLoadingAnimation() {
    loadingActive = false;
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
  }

  function updateLoadingStep() {
    var step = loadingStep;
    var bar = document.querySelector('.progress-fill');
    if (bar) bar.style.width = (((step + 1) / 5) * 100) + '%';
    var counter = document.querySelector('.chrome .step-counter strong');
    if (counter) counter.textContent = String(step + 1).padStart(2, '0');

    var eyebrow = document.querySelector('.narration-eyebrow');
    var narration = document.querySelector('.narration');
    if (eyebrow && narration) {
      eyebrow.style.opacity = '0';
      narration.style.opacity = '0';
      setTimeout(function () {
        if (!loadingActive) return;
        var e2 = document.querySelector('.narration-eyebrow');
        var n2 = document.querySelector('.narration');
        if (e2) { e2.textContent = NARRATION_STEPS[step].eyebrow; e2.style.opacity = '1'; }
        if (n2) { n2.textContent = NARRATION_STEPS[step].text; n2.style.opacity = '1'; }
        // Update pentagon vertex dots
        for (var i = 0; i < 5; i++) {
          var d = document.querySelector('[data-vertex="' + i + '"]');
          if (d) {
            d.setAttribute('r', i === step ? '5' : '3');
            d.setAttribute('fill', i === step ? '#E3AE28' : 'rgba(241,234,217,0.3)');
          }
        }
        // Update progress dots
        document.querySelectorAll('.narration-steps span').forEach(function (sp, idx) {
          sp.className = idx < step ? 'done' : idx === step ? 'active' : '';
        });
      }, 350);
    }
  }

  // ── API calls ──────────────────────────────────────────────
  function buildPayload() {
    var scores = computeScores();
    var bottleneck = identifyBottleneck(scores);
    state.scores = scores;
    state.bottleneck = bottleneck;

    return {
      answers: {
        expertise: state.answers.C1 || '',
        revenue: getAnswerLabel('C2'),
        audience_type: getAnswerLabel('C3'),
        p1: {
          p1_1: getAnswerValue('P1_1'),
          p1_2: getAnswerValue('P1_2'),
          p1_3: getAnswerValue('P1_3'),
          raw: scores[1].raw,
          max: scores[1].max,
          pct: scores[1].pct,
        },
        p2: {
          p2_1: getAnswerValue('P2_1'),
          p2_2: getAnswerValue('P2_2'),
          p2_3: getAnswerValue('P2_3'),
          raw: scores[2].raw,
          max: scores[2].max,
          pct: scores[2].pct,
        },
        p3: {
          p3_1: getAnswerValue('P3_1'),
          p3_2: getAnswerValue('P3_2'),
          p3_3: getAnswerValue('P3_3'),
          raw: scores[3].raw,
          max: scores[3].max,
          pct: scores[3].pct,
        },
        p4: {
          p4_1: getAnswerValue('P4_1'),
          p4_2: getAnswerValue('P4_2'),
          raw: scores[4].raw,
          max: scores[4].max,
          pct: scores[4].pct,
        },
        p5: {
          p5_1: getAnswerValue('P5_1'),
          p5_2: getAnswerValue('P5_2'),
          p5_3: getAnswerValue('P5_3'),
          raw: scores[5].raw,
          max: scores[5].max,
          pct: scores[5].pct,
        },
        bottleneck_pillar: bottleneck,
        language: state.language.toLowerCase(),
      },
    };
  }

  async function callDiagnose(payload) {
    var res = await fetch(PROXY + '/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('diagnose ' + res.status);
    var data = await res.json();
    return data;
  }

  async function callTrack(email, answersData) {
    try {
      await fetch(PROXY + '/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ViewContent',
          user: { email: email },
          properties: {
            bottleneck_pillar: answersData.bottleneck_pillar,
            bottleneck_name: PILLAR_FULL_NAMES[answersData.bottleneck_pillar],
            expertise: answersData.expertise,
            language: answersData.language,
            url: 'https://contraband.onetake.ai/ehv/vpl2-diagnostic/',
          },
        }),
      });
    } catch (e) {
      // Track is non-blocking — never let it break the flow
    }
  }

  function fireViewContent(bottleneck) {
    var props = {
      pillar: String(bottleneck),
      pillar_name: PILLAR_FULL_NAMES[bottleneck],
    };
    // Plausible
    if (typeof window.plausible === 'function') {
      try { window.plausible('ViewContent', { props: props }); } catch (e) {}
    }
    // AnyTrack
    if (typeof window.AnyTrack === 'function') {
      try { window.AnyTrack('trigger', 'ViewContent', { label: props.pillar_name }); } catch (e) {}
    }
  }

  async function runDiagnosis() {
    var startTime = Date.now();
    var minDuration = 5000;
    var payload = buildPayload();

    try {
      var results = await Promise.allSettled([
        callDiagnose(payload),
        callTrack(state.email, payload.answers),
      ]);
      var diagResult = results[0];
      if (diagResult.status === 'fulfilled' && diagResult.value) {
        state.diagnosis = diagResult.value;
        state.diagnosisError = false;
      } else {
        state.diagnosisError = true;
      }
    } catch (e) {
      state.diagnosisError = true;
    }

    var elapsed = Date.now() - startTime;
    if (elapsed < minDuration) {
      await new Promise(function (resolve) { setTimeout(resolve, minDuration - elapsed); });
    }

    fireViewContent(state.bottleneck);
    stopLoadingAnimation();
    state.phase = 'results';
    save();
    render();
  }

  // ── Screen renderers ───────────────────────────────────────

  function renderLanding() {
    var langIdx = SUPPORTED_LANGS.indexOf(state.language);
    var nextLang = SUPPORTED_LANGS[(langIdx + 1) % SUPPORTED_LANGS.length];

    return '<div class="app screen-enter">'
      + '<div class="landing">'
      + '<div class="topbar">'
      + '<div class="logo">' + logoMark(26) + '<span class="logo-text">OneTake AI</span></div>'
      + '<button class="lang-btn" data-action="cycle-lang">'
      + '<span>' + state.language + '</span>'
      + '<svg width="8" height="6" viewBox="0 0 8 6"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>'
      + '</button>'
      + '</div>'
      + '<div class="hero">'
      + '<div class="kicker"><span class="dash"></span><span>The Expert Business Diagnostic</span></div>'
      + '<h1>Find the one pillar holding your <em>expert business</em> back.</h1>'
      + '<div class="sub">A 5-minute assessment. Five pillars. One precise diagnosis — so you know exactly where to start.</div>'
      + '<div class="meta-row">'
      + '<div class="meta"><div class="meta-k">Length</div><div class="meta-v">~5 min</div></div>'
      + '<div class="meta"><div class="meta-k">Questions</div><div class="meta-v">17</div></div>'
      + '<div class="meta"><div class="meta-k">Pillars</div><div class="meta-v">5</div></div>'
      + '</div>'
      + '<div class="cta-block">'
      + '<button class="btn full" data-action="start">Start my diagnostic ' + arrowRight() + '</button>'
      + '<div class="cta-foot">No signup · Results in under 2 minutes</div>'
      + '</div>'
      + '<div class="signoff">'
      + '<div class="avatar">SN</div>'
      + '<div class="who">Designed by <strong>Sébastien Night</strong><br><span class="muted" style="color:var(--ink-mute)">Founder, OneTake AI</span></div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderQuestion() {
    var q = QUESTIONS[state.qIndex];
    var total = QUESTIONS.length;
    var idx = state.qIndex;
    var progress = ((idx + 1) / total * 100).toFixed(1);
    var ans = state.answers[q.id];
    var isText = q.kind === 'text';
    var textValue = isText && typeof ans === 'string' ? ans : '';
    var canAdvance = isAnswered(q.id);

    var optionsHtml = '';
    if (!isText) {
      var opts = getQuestionOptions(q);
      optionsHtml = '<div class="options">'
        + opts.map(function (opt, i) {
          var selected = ans !== undefined && typeof ans === 'object' && ans.idx === i;
          return '<button class="option' + (selected ? ' selected' : '') + '" data-opt-idx="' + i + '" data-opt-value="' + esc(String(opt.value)) + '" data-opt-label="' + esc(opt.label) + '">'
            + '<span>' + esc(opt.label) + '</span>'
            + '<span class="check"></span>'
            + '</button>';
        }).join('')
        + '</div>';
    }

    var inputHtml = isText
      ? '<input class="text-input" type="text" placeholder="' + esc(q.placeholder || '') + '" value="' + esc(textValue) + '" autocomplete="off" spellcheck="false"/>'
      : '';

    return '<div class="app screen-enter">'
      + '<div class="chrome">'
      + '<button class="back" data-action="back">' + chevronLeft() + ' Back</button>'
      + '<div class="step-counter"><strong>' + String(idx + 1).padStart(2, '0') + '</strong> / ' + String(total).padStart(2, '0') + '</div>'
      + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:' + progress + '%"></div></div>'
      + '<div class="body">'
      + '<div class="eyebrow"><span class="label-num">' + esc(q.label) + '</span><span>' + esc(q.section) + '</span><span class="rule"></span></div>'
      + '<h2 class="q-prompt">' + esc(q.prompt) + '</h2>'
      + (q.sub ? '<p class="q-sub">' + esc(q.sub) + '</p>' : '')
      + (q.hint ? '<p class="q-sub">' + esc(q.hint) + '</p>' : '')
      + inputHtml + optionsHtml
      + '</div>'
      + '<div class="action-bar">'
      + '<button class="prev-btn" data-action="back" style="visibility:' + (idx === 0 ? 'hidden' : 'visible') + '">Previous</button>'
      + '<button class="btn" data-action="next"' + (canAdvance ? '' : ' disabled') + '>'
      + (idx === total - 1 ? 'See my diagnostic' : 'Continue')
      + ' ' + arrowRight()
      + '</button>'
      + '</div>'
      + '</div>';
  }

  function renderGate() {
    var emailVal = state.email || '';
    var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);

    return '<div class="app screen-enter">'
      + '<div class="chrome">'
      + '<button class="back" data-action="back">' + chevronLeft() + ' Back</button>'
      + '<div class="step-counter"><strong>READY</strong></div>'
      + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:100%"></div></div>'
      + '<div class="gate">'
      + '<div class="gate-eyebrow">Your diagnostic is ready</div>'
      + '<h2>One last thing — where should we send the <em style="color:var(--accent);font-style:italic">rest of the series</em>?</h2>'
      + '<p class="gate-sub">Drop your email and we\'ll reveal your diagnostic on the next screen. Sébastien will also send you the rest of this series — including the <em style="font-style:italic">Roadmap to a High-Value Expert Business</em>.</p>'
      + '<div class="email-field">'
      + '<label>Email address</label>'
      + '<input class="email-input" type="email" placeholder="you@yourdomain.com" value="' + esc(emailVal) + '" autocomplete="email"/>'
      + '<div class="email-error" hidden></div>'
      + '</div>'
      + '<button class="btn full" data-action="submit-email"' + (valid ? '' : ' disabled') + '>Reveal my diagnostic ' + arrowRight() + '</button>'
      + '<div class="legal">By continuing you agree to receive the rest of the series by email. No spam — unsubscribe in one click.</div>'
      + '</div>'
      + '</div>';
  }

  function renderLoading() {
    var pentagon = '<svg width="180" height="180" viewBox="0 0 180 180">'
      + '<defs><radialGradient id="lglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#E3AE28" stop-opacity="0.25"/><stop offset="100%" stop-color="#E3AE28" stop-opacity="0"/></radialGradient></defs>'
      + '<circle cx="90" cy="90" r="80" fill="url(#lglow)"/>'
      + '<g class="ring-rotate">'
      + [0, 1, 2, 3, 4].map(function (i) {
        var a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        var x = (90 + Math.cos(a) * 60).toFixed(2);
        var y = (90 + Math.sin(a) * 60).toFixed(2);
        return '<line x1="90" y1="90" x2="' + x + '" y2="' + y + '" stroke="rgba(241,234,217,0.15)" stroke-width="0.5"/>'
          + '<circle data-vertex="' + i + '" cx="' + x + '" cy="' + y + '" r="3" fill="rgba(241,234,217,0.3)"/>';
      }).join('')
      + '<polygon points="'
      + [0, 1, 2, 3, 4].map(function (i) {
        var a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return (90 + Math.cos(a) * 60).toFixed(2) + ',' + (90 + Math.sin(a) * 60).toFixed(2);
      }).join(' ')
      + '" fill="none" stroke="rgba(227,174,40,0.4)" stroke-width="0.8" stroke-dasharray="2 4"/>'
      + '</g>'
      + '</svg>';

    return '<div class="app screen-enter">'
      + '<div class="chrome">'
      + '<span class="brand"><span class="dot"></span>DIAGNOSTIC IN PROGRESS</span>'
      + '<div class="step-counter"><strong>01</strong> / 05</div>'
      + '</div>'
      + '<div class="progress"><div class="progress-fill" style="width:20%"></div></div>'
      + '<div class="loading-screen">'
      + '<div class="loading-pentagon">' + pentagon + '<div class="pulse-dot"></div></div>'
      + '<div class="narration-eyebrow">' + esc(NARRATION_STEPS[0].eyebrow) + '</div>'
      + '<div class="narration">' + esc(NARRATION_STEPS[0].text) + '</div>'
      + '<div class="narration-steps">'
      + [0, 1, 2, 3, 4].map(function (i) { return '<span class="' + (i === 0 ? 'active' : '') + '"></span>'; }).join('')
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderResults() {
    var scores = state.scores || computeScores();
    var bottleneck = state.bottleneck || identifyBottleneck(scores);
    var diag = state.diagnosis;
    var expertise = (state.answers.C1 || 'expert').trim();
    var diagError = state.diagnosisError || !diag;

    var pentagonSvg = renderPentagon(scores, bottleneck);

    var pillarChips = [1, 2, 3, 4, 5].map(function (p) {
      var isB = p === bottleneck;
      return '<div class="pillar-chip' + (isB ? ' bottleneck' : '') + '">'
        + '<span class="chip-dot"></span>'
        + '<span>P' + p + '</span>'
        + '<strong>' + scores[p].pct + '</strong>'
        + '</div>';
    }).join('');

    var month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    var diagnosisHtml = '';
    if (diagError) {
      diagnosisHtml = '<div class="diagnosis-block">'
        + '<div class="diagnosis-tag">Your bottleneck · Pillar ' + bottleneck + '</div>'
        + '<h2 class="diagnosis-name">' + esc(PILLAR_FULL_NAMES[bottleneck]) + '</h2>'
        + '<p class="diagnosis-intro">Your profile highlights Pillar ' + bottleneck + ' as the area to focus on first.</p>'
        + '<p class="diagnosis-body" style="color:var(--ink-soft);font-style:italic">The detailed AI diagnosis could not be generated. Your pillar scores above show where to focus.</p>'
        + '</div>';
    } else {
      var interp = function (s) { return (s || '').replace(/\{\{expertise\}\}/g, esc(expertise)); };
      diagnosisHtml = '<div class="diagnosis-block">'
        + '<div class="diagnosis-tag">Your bottleneck · Pillar ' + bottleneck + '</div>'
        + '<h2 class="diagnosis-name">' + esc(diag.bottleneck_name) + '</h2>'
        + '<p class="diagnosis-intro">' + interp(esc(diag.bottleneck_intro)) + '</p>'
        + '<div class="diagnosis-body">' + nlToParagraphs(interp(diag.why_this_pillar)) + '</div>'
        + '<div class="callout">'
        + '<div class="callout-label">What happens if you don\'t fix this first</div>'
        + '<div class="callout-text">' + interp(esc(diag.what_happens_without_it)) + '</div>'
        + '</div>'
        + '<div class="first-move">'
        + '<div class="first-move-label">Your first move</div>'
        + '<div class="first-move-headline">This week, not someday</div>'
        + '<div class="first-move-body">' + interp(esc(diag.first_move)) + '</div>'
        + '</div>'
        + '<div class="encouragement">"' + interp(esc(diag.encouragement)) + '"</div>'
        + '</div>';
    }

    return '<div class="app results-screen screen-enter">'
      + '<div class="results-head">'
      + '<div class="res-eyebrow"><span>Issue №1 · ' + esc(month) + '</span><span class="rule"></span></div>'
      + '<h1 class="res-title">Here\'s what your answers <em>reveal</em>.</h1>'
      + '<div class="res-byline">Diagnostic profile · 5 pillars · ranked</div>'
      + '</div>'
      + '<div class="pillar-viz">' + pentagonSvg + '<div class="pillar-meta">' + pillarChips + '</div></div>'
      + diagnosisHtml
      + '<div class="next-step">'
      + '<div class="next-step-eyebrow">What\'s next</div>'
      + '<h3>In the next video — the <em>Roadmap to a High-Value Expert Business</em> — Sébastien walks you through putting all 5 pillars in place, in order.</h3>'
      + '<div class="actions">'
      + '<button class="btn full" data-action="share">Share my result ' + arrowRight() + '</button>'
      + '<button class="copy-btn' + (state.copied ? ' copied' : '') + '" data-action="copy">'
      + (state.copied ? checkIcon() + ' Copied to clipboard' : copyIcon() + ' Copy my diagnostic')
      + '</button>'
      + '<button class="copy-btn" data-action="restart">' + retakeIcon() + ' Retake the diagnostic</button>'
      + '</div>'
      + '<div class="footnote">Your answers were anonymous. Your bottleneck is yours to keep.</div>'
      + '</div>'
      + '</div>';
  }

  // ── Render dispatcher ──────────────────────────────────────
  function render() {
    var container = document.getElementById('app');
    document.body.className = state.phase;

    switch (state.phase) {
      case 'landing':  container.innerHTML = renderLanding(); break;
      case 'question': container.innerHTML = renderQuestion(); break;
      case 'gate':     container.innerHTML = renderGate(); break;
      case 'loading':  container.innerHTML = renderLoading(); break;
      case 'results':  container.innerHTML = renderResults(); break;
    }

    attachListeners();

    if (state.phase === 'loading') {
      startLoadingAnimation();
      runDiagnosis();
    }

    if (state.phase === 'question') {
      var input = container.querySelector('.text-input');
      if (input) setTimeout(function () { input.focus(); }, 80);
    }

    if (state.phase === 'gate') {
      var emailInput = container.querySelector('.email-input');
      if (emailInput) setTimeout(function () { emailInput.focus(); }, 80);
    }

    if (state.phase === 'results') {
      window.scrollTo(0, 0);
    }
  }

  // ── Event listeners ────────────────────────────────────────
  function attachListeners() {
    var container = document.getElementById('app');

    // Delegated click on data-action buttons
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');

      if (action === 'start') {
        state.answers = {};
        state.qIndex = 0;
        state.phase = 'question';
        save();
        render();

      } else if (action === 'next') {
        var q = QUESTIONS[state.qIndex];
        if (q && q.kind === 'text') {
          var inp = container.querySelector('.text-input');
          if (inp) state.answers[q.id] = inp.value.trim();
        }
        if (!isAnswered(QUESTIONS[state.qIndex].id)) return;
        if (state.qIndex < QUESTIONS.length - 1) {
          state.qIndex++;
        } else {
          state.phase = 'gate';
        }
        save();
        render();

      } else if (action === 'back') {
        if (state.phase === 'question') {
          if (state.qIndex > 0) { state.qIndex--; }
          else { state.phase = 'landing'; }
        } else if (state.phase === 'gate') {
          state.qIndex = QUESTIONS.length - 1;
          state.phase = 'question';
        }
        save();
        render();

      } else if (action === 'submit-email') {
        var emailInp = container.querySelector('.email-input');
        var email = emailInp ? emailInp.value.trim() : state.email;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
        state.email = email;
        var submitBtn = container.querySelector('[data-action="submit-email"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking…'; }
        bouncerValidate(email, function (valid) {
          if (!valid) {
            var errEl = container.querySelector('.email-error');
            if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.hidden = false; }
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Reveal my diagnostic ' + arrowRight(); }
            return;
          }
          state.phase = 'loading';
          save();
          render();
        });

      } else if (action === 'share') {
        window.open(SHARE_URL, '_blank');

      } else if (action === 'copy') {
        handleCopy();

      } else if (action === 'restart') {
        state.answers = {};
        state.qIndex = 0;
        state.phase = 'landing';
        state.scores = null;
        state.bottleneck = null;
        state.diagnosis = null;
        state.diagnosisError = false;
        state.email = '';
        state.copied = false;
        sessionStorage.removeItem('diag_v1');
        render();

      } else if (action === 'cycle-lang') {
        var idx = SUPPORTED_LANGS.indexOf(state.language);
        state.language = SUPPORTED_LANGS[(idx + 1) % SUPPORTED_LANGS.length];
        save();
        render();
      }
    });

    // Option pills
    container.querySelectorAll('.option').forEach(function (el) {
      el.addEventListener('click', function () {
        var q = QUESTIONS[state.qIndex];
        var idx = parseInt(el.getAttribute('data-opt-idx'), 10);
        var value = el.getAttribute('data-opt-value');
        var label = el.getAttribute('data-opt-label');
        // Convert value to number if it looks numeric
        var numVal = Number(value);
        state.answers[q.id] = { value: isNaN(numVal) ? value : numVal, label: label, idx: idx };

        // Highlight selected option
        container.querySelectorAll('.option').forEach(function (o) { o.classList.remove('selected'); });
        el.classList.add('selected');

        // Enable Next button
        var nextBtn = container.querySelector('[data-action="next"]');
        if (nextBtn) nextBtn.removeAttribute('disabled');

        // Auto-advance after short delay for choice questions
        setTimeout(function () {
          if (state.phase === 'question' && isAnswered(q.id)) {
            if (state.qIndex < QUESTIONS.length - 1) {
              state.qIndex++;
            } else {
              state.phase = 'gate';
            }
            save();
            render();
          }
        }, 280);
      });
    });

    // Text input live save + enter key
    var textInput = container.querySelector('.text-input');
    if (textInput) {
      textInput.addEventListener('input', function () {
        var q = QUESTIONS[state.qIndex];
        state.answers[q.id] = textInput.value;
        var nextBtn = container.querySelector('[data-action="next"]');
        if (nextBtn) {
          if (textInput.value.trim().length > 0) nextBtn.removeAttribute('disabled');
          else nextBtn.setAttribute('disabled', '');
        }
      });
      textInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var q = QUESTIONS[state.qIndex];
          state.answers[q.id] = textInput.value.trim();
          if (isAnswered(q.id)) {
            if (state.qIndex < QUESTIONS.length - 1) { state.qIndex++; }
            else { state.phase = 'gate'; }
            save();
            render();
          }
        }
      });
    }

    // Email input live validation + enter key
    var emailInput = container.querySelector('.email-input');
    if (emailInput) {
      emailInput.addEventListener('input', function () {
        state.email = emailInput.value.trim();
        var submitBtn = container.querySelector('[data-action="submit-email"]');
        if (submitBtn) {
          var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email);
          if (valid) submitBtn.removeAttribute('disabled');
          else submitBtn.setAttribute('disabled', '');
        }
      });
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email);
          if (valid) {
            state.phase = 'loading';
            save();
            render();
          }
        }
      });
    }
  }

  // ── Copy diagnostic ────────────────────────────────────────
  function handleCopy() {
    var scores = state.scores || computeScores();
    var bottleneck = state.bottleneck || identifyBottleneck(scores);
    var diag = state.diagnosis;
    var expertise = state.answers.C1 || '—';

    var lines = [
      'MY EXPERT BUSINESS DIAGNOSTIC',
      '',
      'Field: ' + expertise,
      '',
      'Pillar scores:',
      '  P1 Positioning:        ' + scores[1].pct + '/100',
      '  P2 Irresistible Offer: ' + scores[2].pct + '/100',
      '  P3 Audience:           ' + scores[3].pct + '/100',
      '  P4 Sales Machine:      ' + scores[4].pct + '/100',
      '  P5 Notoriety:          ' + scores[5].pct + '/100',
      '',
      '→ Bottleneck: Pillar ' + bottleneck + ' — ' + PILLAR_FULL_NAMES[bottleneck],
    ];

    if (diag && diag.bottleneck_intro) {
      lines.push('');
      lines.push(diag.bottleneck_intro.replace(/\{\{expertise\}\}/g, expertise));
    }

    lines.push('');
    lines.push('— Diagnostic des Business d\'Expert · OneTake AI');

    var text = lines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        state.copied = true;
        render();
        setTimeout(function () { state.copied = false; render(); }, 2500);
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    state.copied = true;
    render();
    setTimeout(function () { state.copied = false; render(); }, 2500);
  }

  // ── useBouncer email validation ────────────────────────────
  function bouncerValidate(email, cb) {
    if (typeof window.useBouncer !== 'function') { cb(true); return; }
    window.useBouncer(email, function (result) {
      var blocked = result && (result.status === 'invalid' || result.status === 'disposable' || result.valid === false);
      cb(!blocked);
    });
  }

  // ── Service worker registration ────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/ehv/vpl2-diagnostic/sw.js', {
        scope: '/ehv/vpl2-diagnostic/',
      }).catch(function () {});
    }
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    restore();

    // If we were mid-loading when user left, send them back to gate
    if (state.phase === 'loading') state.phase = 'gate';

    render();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
