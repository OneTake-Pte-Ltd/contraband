/* ==========================================================================
   The High-Value Expert Roadmap — vanilla JS router + views
   ========================================================================== */

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const data = window.ROADMAP;

  // -- helpers --------------------------------------------------------------
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  const pillarById = (id) => data.pillars.find((p) => p.id === id);
  const stepById = (id) => data.steps.find((s) => s.id === id);
  const stepsForPillar = (p) => p.stepIds.map(stepById).filter(Boolean);
  const examplesForPillar = (p) =>
    data.examples.filter((ex) => ex.pillarIds.includes(p.id));
  const testimonialsForPillar = (p) =>
    data.testimonials.filter((t) => t.pillarIds.includes(p.id));

  // -- views ----------------------------------------------------------------
  function viewHome() {
    const { meta } = data;
    return `
      <section class="home">
        <header class="home-hero">
          <div>
            <div class="eyebrow">A field guide for the high-value expert</div>
            <h1>The <em>Roadmap</em> to become a High-Value Expert.</h1>
            <div class="meta">
              <span><strong>5</strong> pillars</span>
              <span><strong>12</strong> steps</span>
              <span><strong>1</strong> page</span>
            </div>
          </div>
          <p class="lede">${esc(meta.intro)}</p>
        </header>

        <nav class="pillar-toc" aria-label="The five pillars">
          ${data.pillars
            .map(
              (p) => `
            <a class="pillar-row" href="#/pillar/${p.id}" aria-label="Open pillar ${p.numeral}: ${esc(p.name)}">
              <span class="numeral">${p.numeral}</span>
              <div class="name">
                <h2>${esc(p.name)}</h2>
                <div class="kicker">${esc(p.kicker)}</div>
              </div>
              <div class="tagline">${esc(p.tagline)}</div>
              <div class="pillar-row-cta">Explore  &rarr;</div>
            </a>
          `
            )
            .join('')}
        </nav>

        <section class="home-secondary">
          <div>
            <div class="eyebrow" style="margin-bottom:0.75rem;">How to use this</div>
            <h2>You don\u2019t need to do everything.</h2>
            <p class="promise">${esc(data.closing.promise)}</p>
            <p class="promise" style="margin-top:1rem;color:var(--ink-strong);">${esc(data.closing.invitation)}</p>
          </div>
          <aside class="why-mentor-card" aria-label="Why work with a mentor">
            <h3>Why a mentor</h3>
            <p>The pieces of the puzzle are not the obstacle. What\u2019s missing is someone who sits down beside you and says, &ldquo;focus on this one piece, ignore the rest, move.&rdquo;</p>
            <p style="margin-top:0.75rem;color:var(--ink-muted);font-size:0.95rem;">Each pillar below carries a short note on where a mentor changes the outcome \u2014 and which session of <em>${esc(data.closing.program)}</em> covers it.</p>
            <a class="ask-link" href="${esc(data.meta.askUrl)}" target="_blank" rel="noopener">Ask a question about the program <span aria-hidden="true">→</span></a>
          </aside>
        </section>
      </section>
    `;
  }

  function viewPillar(id) {
    const p = pillarById(id);
    if (!p) return viewHome();
    const idx = data.pillars.findIndex((x) => x.id === p.id);
    const prev = data.pillars[idx - 1];
    const next = data.pillars[idx + 1];

    const steps = stepsForPillar(p);
    const examples = examplesForPillar(p);
    const testimonials = testimonialsForPillar(p);

    return `
      <article class="pillar-page">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="#/">The Roadmap</a>
          <span class="sep">/</span>
          <span>Pillar ${p.numeral} · ${esc(p.name)}</span>
        </nav>

        <header class="pillar-hero">
          <div class="topline">
            <span class="numeral">${p.numeral}</span>
            <span class="eyebrow">Pillar ${p.numeral} of V</span>
          </div>
          <div>
            <h1>${esc(p.name)}<em>.</em></h1>
            <div class="kicker">${esc(p.kicker)}</div>
            <p class="tagline-large">${esc(p.tagline)}</p>
          </div>
        </header>

        <section class="story">
          <div class="label">Life when it\u2019s in place</div>
          <div class="body">
            <h2>${esc(p.summary)}</h2>
            <ul>
              ${p.lifeWhenInPlace.map((line) => `<li>${esc(line)}</li>`).join('')}
            </ul>
          </div>
        </section>

        <section class="story">
          <div class="label">The obstacle</div>
          <div class="body">
            <p class="pull-quote">${esc(p.obstacle.quote)}</p>
            <p>${esc(p.obstacle.explanation)}</p>
          </div>
        </section>

        <section class="story">
          <div class="label">The solution</div>
          <div class="body">
            <p>${esc(p.solution)}</p>
          </div>
        </section>

        <section class="steps-section">
          <header>
            <div class="label">${steps.length === 1 ? 'The step' : 'The steps'}</div>
            <div>
              <h2>${steps.length === 1 ? 'One step builds this pillar.' : `${steps.length} steps build this pillar.`}</h2>
              <p style="font-family:var(--serif);color:var(--ink-muted);max-width:48ch;margin-top:0.5rem;">Each step is small enough to start this week, concrete enough to know when it\u2019s done.</p>
            </div>
          </header>
          <div class="step-grid">
            <div></div>
            <div class="step-list">
              ${steps
                .map(
                  (s) => `
                <article class="step-card">
                  <div class="step-number">${s.id < 10 ? '0' + s.id : s.id}</div>
                  <div>
                    <h3>${esc(s.title)}</h3>
                    <p class="what">${esc(s.what)}</p>
                    <div class="step-actions">
                      <div>
                        <span class="lbl">Do this week</span>
                        ${esc(s.doThisWeek)}
                      </div>
                      <div>
                        <span class="lbl">You\u2019re done when</span>
                        ${esc(s.done)}
                      </div>
                    </div>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
          </div>
        </section>

        ${examples.length > 0 ? `
          <section class="examples">
            <div class="label-col"><div class="label">Examples</div></div>
            <div class="body">
              <h2>Experts who built this pillar.</h2>
              ${examples
                .map(
                  (ex) => `
                <div class="example">
                  <div class="name">${esc(ex.name)}</div>
                  <div>
                    <div class="headline">${esc(ex.headline)}</div>
                    <div class="story">${esc(ex.story)}</div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </section>
        ` : ''}

        <section class="why-mentor">
          <div class="label-col">
            <div class="label">Why a mentor</div>
          </div>
          <div class="body">
            <h2>${esc(p.whyMentor.headline)}</h2>
            <p class="lede">${esc(p.whyMentor.body)}</p>
            <div class="session-line">
              <span aria-hidden="true" style="color:var(--accent);font-family:var(--serif);font-style:italic;font-size:1.2rem;line-height:1;">§</span>
              <span><strong>In Le Cercle.</strong> ${esc(p.whyMentor.cercleSession)}</span>
            </div>
            <p style="margin-top:1rem;"><a class="ask-link" href="${esc(data.meta.askUrl)}" target="_blank" rel="noopener">Ask a question about the program <span aria-hidden="true">→</span></a></p>

            ${testimonials.length > 0 ? `
              <div class="testimonials" aria-label="Voices from the bootcamp">
                ${testimonials
                  .map(
                    (t) => `
                  <figure class="testimonial">
                    <blockquote class="quote">${esc(t.quote)}</blockquote>
                    <figcaption>
                      <div class="from">${esc(t.from)}</div>
                      <div class="context">${esc(t.context)}</div>
                    </figcaption>
                  </figure>
                `
                  )
                  .join('')}
              </div>
            ` : ''}
          </div>
        </section>

        <nav class="pillar-nav" aria-label="Pillar navigation">
          ${prev
            ? `<a class="prev" href="#/pillar/${prev.id}">
                 <span class="dir">\u2190 Previous pillar</span>
                 <span class="name">${prev.numeral} \u00b7 ${esc(prev.name)}</span>
               </a>`
            : `<a class="prev disabled" aria-hidden="true">
                 <span class="dir">\u2190 The roadmap</span>
                 <span class="name">Five pillars</span>
               </a>`}
          ${next
            ? `<a class="next" href="#/pillar/${next.id}">
                 <span class="dir">Next pillar \u2192</span>
                 <span class="name">${next.numeral} \u00b7 ${esc(next.name)}</span>
               </a>`
            : `<a class="next" href="#/">
                 <span class="dir">Back to the map \u2192</span>
                 <span class="name">All five pillars</span>
               </a>`}
        </nav>
      </article>
    `;
  }

  function viewFooterCta() {
    const c = data.closing;
    return `
      <section class="footer-cta">
        <div class="inner">
          <div>
            <div class="eyebrow" style="margin-bottom:1rem;">Where the roadmap leads</div>
            <h2>You don\u2019t need to do this alone.</h2>
            <p class="promise">${esc(c.promise)}</p>
            <p class="invitation">${esc(c.invitation)}</p>
          </div>
          <aside class="program-card">
            <div class="label">The mentorship</div>
            <h3>${esc(c.program)}</h3>
            <p>${esc(c.programDescription)}</p>
            <span class="pill">12 live sessions · small group · 6 months</span>
            <a class="ask-link ask-link--button" href="${esc(data.meta.askUrl)}" target="_blank" rel="noopener">Ask a question about the program <span aria-hidden="true">→</span></a>
          </aside>
        </div>
      </section>
    `;
  }

  // -- router ---------------------------------------------------------------
  function parseRoute() {
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash || hash === '/' || hash === '') return { name: 'home' };
    const m = hash.match(/^\/pillar\/(\d+)/);
    if (m) return { name: 'pillar', id: Number(m[1]) };
    return { name: 'home' };
  }

  function render() {
    const route = parseRoute();
    const main = $('#app-main');
    let html = '';
    if (route.name === 'pillar') {
      html = viewPillar(route.id);
    } else {
      html = viewHome();
    }
    html += viewFooterCta();
    main.innerHTML = html;
    document.title =
      route.name === 'pillar'
        ? `${pillarById(route.id)?.name ?? ''} \u00b7 ${data.meta.title}`
        : data.meta.title;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);

  // -- service worker -------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
})();
