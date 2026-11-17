// Nendrė — page logic: 3D mount, configurator, price, AR, swipe rows, lightbox, form
import { createViewer } from './table3d.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TOUCH = document.documentElement.classList.contains('touch');
const eur = n => '€' + Math.round(n).toLocaleString('en-US');

/* ---------- nav ---------- */
const nav = $('[data-nav]');
const onScrollNav = () => nav.classList.toggle('sc', scrollY > 20);
addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();
$('[data-menu]').addEventListener('click', e => { const o = nav.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); });
$$('[data-sheet] a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); $('[data-menu]').setAttribute('aria-expanded', false); }));

/* ---------- reveal ---------- */
(() => {
  const els = $$('.rv');
  if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
})();

/* ---------- 3D viewer: one renderer, moved to whichever stage is on screen ---------- */
const viewer = createViewer();
const stages = { hero: $('[data-stage="hero"]'), cfg: $('[data-stage="cfg"]') };
viewer.mount(stages.hero);
const vis = new Map();
const sio = new IntersectionObserver(es => {
  es.forEach(e => vis.set(e.target, e.intersectionRatio));
  const h = vis.get(stages.hero) || 0, c = vis.get(stages.cfg) || 0;
  const target = c > h ? stages.cfg : stages.hero;
  if ((h || c) && target) viewer.mount(target);
}, { threshold: [0, .15, .3, .5, .7, 1] });
sio.observe(stages.hero); sio.observe(stages.cfg);
// "ready" once the first frame with wood is drawn
const waitReady = setInterval(() => { if (viewer.canvas.width > 10) { setTimeout(() => $$('.stage').forEach(s => s.classList.add('ready')), 600); clearInterval(waitReady); } }, 200);
$$('.stage').forEach(s => s.addEventListener('pointerdown', () => s.classList.add('touched'), { once: true }));

/* ---------- configurator ---------- */
const form = $('[data-panel]');
const RATE = { oak: 780, ash: 690, walnut: 1250 }, BASE = { taper: 290, panel: 360, steel: 420 }, SHAPE = { rect: 0, soft: 90, oval: 180 }, FIN = { natural: 0, white: 40, dark: 60 };
const DENS = { oak: 720, ash: 690, walnut: 640 }, BASEKG = { taper: 14, panel: 22, steel: 26 };
const NAMES = { oak: 'Oak', ash: 'Ash', walnut: 'Walnut', rect: 'straight', soft: 'soft corners', oval: 'oval', taper: 'tapered legs', panel: 'solid panels', steel: 'black steel base', natural: 'natural oil', white: 'white oil', dark: 'dark oil' };
let shown = 0;
function read() {
  const f = new FormData(form);
  return { wood: f.get('wood'), L: +f.get('L'), W: +f.get('W'), shape: f.get('shape'), base: f.get('base'), finish: f.get('finish') };
}
function calc(c) {
  const area = c.L / 100 * c.W / 100 * (c.shape === 'oval' ? .86 : c.shape === 'soft' ? .98 : 1);
  const price = Math.round((area * RATE[c.wood] + BASE[c.base] + SHAPE[c.shape] + FIN[c.finish]) / 10) * 10;
  const side = Math.floor((c.L - 10) / 50), ends = c.W >= 100 && c.L >= 200 ? 2 : 0;
  const kg = Math.round(area * .04 * DENS[c.wood] + BASEKG[c.base]);
  const weeks = c.wood === 'walnut' ? 10 : 8;
  const d = new Date(); d.setDate(d.getDate() + weeks * 7);
  const ready = (d.getDate() <= 10 ? 'early ' : d.getDate() <= 20 ? 'mid-' : 'late ') + d.toLocaleString('en-GB', { month: 'long' });
  return { price, seats: [side * 2, side * 2 + ends], kg, ready, weeks };
}
function seatsSVG(c, s) {
  const svg = $('[data-seats]'); const w = 30 + (c.L - 160) / 120 * 90, h = 22 + (c.W - 90) / 20 * 10, x = (160 - w) / 2, y = (90 - h) / 2;
  const rx = c.shape === 'oval' ? h / 2 : c.shape === 'soft' ? 7 : 1.5;
  let o = `<rect class="t" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
  const side = s.seats[0] / 2;
  for (let i = 0; i < side; i++) { const cx = x + w * (i + .5) / side; o += `<circle class="c" cx="${cx}" cy="${y - 9}" r="4.2"/><circle class="c" cx="${cx}" cy="${y + h + 9}" r="4.2"/>`; }
  if (s.seats[1] > s.seats[0]) o += `<circle class="c" cx="${x - 9}" cy="45" r="4.2" opacity=".55"/><circle class="c" cx="${x + w + 9}" cy="45" r="4.2" opacity=".55"/>`;
  svg.innerHTML = o;
}
function animPrice(to) {
  const el = $('[data-price]'), from = shown, t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 450), v = from + (to - from) * (1 - (1 - k) ** 3); el.textContent = eur(v); if (k < 1) requestAnimationFrame(step); };
  shown = to; requestAnimationFrame(step);
  $('[data-bar-price]').textContent = eur(to);
}
function text(c) { return `${NAMES[c.wood]}, ${c.L} × ${c.W} cm, ${NAMES[c.shape]}, ${NAMES[c.base]}, ${NAMES[c.finish]} — ${eur(calc(c).price)}`; }
let raf = 0;
function update(fromUser = true) {
  const c = read(), s = calc(c);
  const r = $('input[name=L]'); r.style.setProperty('--p', ((c.L - 160) / 120 * 100) + '%');
  $('[data-out="L"]').textContent = c.L + ' cm';
  $('[data-o="seats"]').textContent = s.seats[1] > s.seats[0] ? `${s.seats[0]}–${s.seats[1]} people` : `${s.seats[0]} people`;
  $('[data-o="kg"]').textContent = s.kg + ' kg';
  $('[data-o="ready"]').textContent = `${s.ready} · ${s.weeks - 2}–${s.weeks} weeks`;
  $('[data-boards]').textContent = Math.max(4, Math.round(c.W / 100 / .14));
  $('[data-legtext]').textContent = { taper: 'Tapered leg, 6.2 → 3.6 cm', panel: 'Solid 4.5 cm panel, wedged', steel: 'Powder-coated steel, bolted to a wooden rail' }[c.base];
  seatsSVG(c, s); animPrice(s.price);
  $('[data-cfg-text]').value = text(c);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => viewer.set({ wood: c.wood, L: c.L / 100, W: c.W / 100, shape: c.shape, base: c.base, finish: c.finish }));
  if (fromUser) history.replaceState(null, '', '#build?' + new URLSearchParams(Object.entries(c)).toString());
}
form.addEventListener('input', () => update());
// restore from a shared link
(() => {
  const q = location.hash.split('?')[1]; if (!q) return;
  const p = new URLSearchParams(q);
  for (const [k, v] of p) { const el = form.querySelector(`[name="${k}"][value="${v}"]`) || (k === 'L' && form.querySelector('[name=L]')); if (!el) continue; if (el.type === 'range') el.value = v; else el.checked = true; }
})();
update(false);

// woods cards → configurator
$$('[data-pick]').forEach(b => b.addEventListener('click', () => {
  form.querySelector(`[name=wood][value=${b.dataset.pick}]`).checked = true; update();
  $('#build').scrollIntoView({ behavior: 'smooth' }); toast(NAMES[b.dataset.pick] + ' is on your table');
}));

// assembled / joinery
$$('[data-view]').forEach(b => b.addEventListener('click', () => {
  const on = b.dataset.view === '1';
  $$('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
  viewer.explodeTo(on ? 1 : 0);
  const labs = $('[data-labels]');
  if (on) {
    labs.hidden = false;
    viewer.setLabels($$('.lab', labs).map(el => ({ el, at: viewer.point(el.dataset.lab) })));
  } else { labs.hidden = true; viewer.setLabels([]); }
}));

// share
$('[data-share]').addEventListener('click', async () => {
  const url = location.href.split('#')[0] + '#build?' + new URLSearchParams(Object.entries(read()));
  try { if (navigator.share && TOUCH) await navigator.share({ title: 'My Nendrė table', url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { }
});
$('[data-reserve]').addEventListener('click', () => { $('#o-what').value = 'Reserve this table'; });

// AR: iPhone / iPad Quick Look
(() => {
  const btn = $('[data-ar]'), note = $('[data-ar-note]');
  const a = document.createElement('a'); const ios = a.relList && a.relList.supports && a.relList.supports('ar');
  btn.addEventListener('click', async () => {
    if (!ios) {
      note.hidden = false;
      note.textContent = /Android/i.test(navigator.userAgent) ? 'AR view works on iPhone and iPad for now. On Android it is coming soon.' : 'Open this page on an iPhone or iPad and tap this button: the table appears in your room at its real size.';
      setTimeout(() => note.hidden = true, 5000); return;
    }
    const lbl = $('span', btn), o = lbl.textContent; lbl.textContent = 'Preparing…';
    try {
      const blob = await viewer.usdz();
      a.rel = 'ar'; a.href = URL.createObjectURL(blob); a.download = 'nendre-table.usdz';
      a.innerHTML = '<img alt="">'; document.body.append(a); a.click(); setTimeout(() => a.remove(), 1000);
    } catch (e) { note.hidden = false; note.textContent = 'Could not open the AR view on this device.'; }
    lbl.textContent = o;
  });
})();

/* ---------- swipe rows: dots ---------- */
$$('[data-swipe]').forEach(row => {
  const name = row.classList[0]; const dots = $(`[data-dots-for="${name}"]`); if (!dots) return;
  const kids = [...row.children];
  dots.innerHTML = kids.map((_, i) => `<button type="button" aria-label="Item ${i + 1} of ${kids.length}"></button>`).join('');
  const bs = [...dots.children];
  const upd = () => { const w = kids[0].offsetWidth + 14; let i = Math.round(row.scrollLeft / w); if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 4) i = kids.length - 1; bs.forEach((b, k) => b.setAttribute('aria-current', k === i)); };
  bs.forEach((b, i) => b.addEventListener('click', () => row.scrollTo({ left: kids[i].offsetLeft - kids[0].offsetLeft, behavior: 'smooth' })));
  row.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true }); upd();
});

/* ---------- lightbox ---------- */
(() => {
  const lb = $('[data-lb]'), tr = $('[data-lb-track]'), cap = $('[data-lb-cap]'), cnt = $('[data-lb-count]');
  const imgs = $$('[data-gallery] img'); const N = imgs.length; let li = 0, opener;
  tr.innerHTML = imgs.map(i => `<li><img srcset="${i.getAttribute('srcset')}" sizes="100vw" src="${i.getAttribute('src')}" alt="${i.alt}" loading="lazy"></li>`).join('');
  const slides = [...tr.children];
  const upd = () => { li = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); cap.textContent = imgs[li]?.alt || ''; cnt.textContent = (li + 1) + ' / ' + N; };
  tr.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
  const open = i => { opener = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; requestAnimationFrame(() => { lb.classList.add('open'); tr.scrollLeft = i * tr.clientWidth; upd(); $('[data-lb-close]').focus(); }); };
  const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => lb.hidden = true, 350); opener?.focus?.(); };
  $$('[data-open]').forEach(b => b.addEventListener('click', () => open(+b.dataset.open)));
  $('[data-lb-close]').addEventListener('click', close);
  addEventListener('keydown', e => { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') tr.scrollBy({ left: tr.clientWidth, behavior: 'smooth' }); if (e.key === 'ArrowLeft') tr.scrollBy({ left: -tr.clientWidth, behavior: 'smooth' }); });
  let y0 = null; tr.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  tr.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 110) close(); y0 = null; }, { passive: true });
})();

/* ---------- phone bar: after the hero, hidden over the configurator and the form ---------- */
(() => {
  const bar = $('[data-bar]'); if (!bar) return;
  const hide = new Set(); let past = false;
  const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? hide.add(e.target) : hide.delete(e.target)); bar.classList.toggle('on', past && hide.size === 0); }, { threshold: .1 });
  [$('.cfg'), $('#order'), $('.foot')].forEach(el => el && io.observe(el));
  const hio = new IntersectionObserver(es => { past = !es[0].isIntersecting; bar.classList.toggle('on', past && hide.size === 0); });
  hio.observe($('.hero .row'));
})();

/* ---------- form ---------- */
(() => {
  const f = $('[data-form]'), st = $('[data-status]');
  f.addEventListener('submit', e => {
    e.preventDefault(); let first = null;
    $$('[required]', f).forEach(i => {
      const bad = !i.value.trim() || (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value));
      i.setAttribute('aria-invalid', bad); i.parentElement.querySelector('.err').hidden = !bad; if (bad && !first) first = i;
    });
    if (first) { first.focus(); st.textContent = ''; return; }
    st.textContent = 'Thank you. Rasa will write to you within one working day. (Concept site: nothing was sent.)';
    f.reset(); update(false);
  });
})();

/* ---------- toast ---------- */
let tt; function toast(t) { const el = $('[data-toast]'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2000); }
