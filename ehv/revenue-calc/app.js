/* Revenue-Oriented Content Calculator — OneTake AI */
(function () {
  'use strict';

  // ── Proxy URL (replace with your Bunny Edge Script endpoint) ──────────────
  var PROXY_URL = 'https://REPLACE_WITH_YOUR_BUNNY_EDGE_SCRIPT_URL/track';

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
    'Books', 'Masterminds', 'Software', 'Therapy', 'E-commerce', 'Other',
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
    hoursPerWeek: 0,
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
