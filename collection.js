// Nendrė — collection filters, quick view in 3D, order list
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const eur = n => '€' + Math.round(n).toLocaleString('en-US');

const INFO = {
  chair:    { cat: 'Seating', price: 390, fab: 'opt', dims: '46 × 52 × 79 cm', weeks: '6–8', desc: 'The back rail is steam-bent from one piece and wedged into the posts, so it never works loose. Sold singly; most people take six.' },
  bench:    { cat: 'Seating', price: 690, dims: '160 × 36 × 45 cm', weeks: '6–8', desc: 'A 4.5 cm solid top on splayed legs. Pairs with any Nendrė table, or stands in the hall for boots and bags.' },
  sofa:     { cat: 'Seating', price: 3900, fab: 1, dims: '220 × 92 × 78 cm', weeks: '8–10', desc: 'An oak frame with feather-and-foam cushions. Every cover zips off for the wash, and the frame is guaranteed for 25 years.' },
  armchair: { cat: 'Seating', price: 1650, fab: 1, dims: '84 × 88 × 78 cm', weeks: '8–10', desc: 'The single seat of the Debesis sofa: low, deep and built for long evenings with a book.' },
  coffee:   { cat: 'Tables', price: 890, dims: '120 × 60 × 38 cm', weeks: '6–8', desc: 'Rounded corners for small children, a lower shelf for books, and a top that a hot mug will not mark.' },
  sideboard:{ cat: 'Storage', price: 2450, dims: '180 × 45 × 78 cm', weeks: '8–10', desc: 'Four doors of hand-fitted slats, adjustable shelves inside and solid brass pulls. Takes a turntable and the records under it.' },
  wardrobe: { cat: 'Storage', price: 3200, dims: '120 × 60 × 210 cm', weeks: '10–12', desc: 'Two grooved doors on soft-close hinges, a hanging rail and four shelves. Delivered in parts and assembled in your room.' },
  shelf:    { cat: 'Storage', price: 1290, dims: '90 × 35 × 190 cm', weeks: '6–8', desc: 'Six solid 2.8 cm shelves that carry 40 kg each without sagging. Fixed to the wall with a hidden bracket.' },
  bed:      { cat: 'Bedroom', price: 2690, fab: 1, dims: '160 × 200 cm (also 140, 180)', weeks: '8–10', desc: 'A frame for a 160 × 200 mattress with a slatted headboard and solid-wood slats. Bedding shown for scale, fabric is the cushion colour.' },
};
const NAME = Object.fromEntries($$('.pcard').map(c => [c.querySelector('[data-qv]')?.dataset.qv, c.querySelector('h3').textContent]).filter(x => x[0]));
const WOODK = { oak: 1, ash: .92, walnut: 1.32 }, FINK = { natural: 0, white: 30, dark: 40 };
const FABN = { oat: 'Oat linen', moss: 'Moss wool', rust: 'Rust bouclé', charcoal: 'Charcoal wool', sky: 'Sky cotton' };

/* filters */
$$('.filters button').forEach(b => b.addEventListener('click', () => {
  $$('.filters button').forEach(x => x.setAttribute('aria-selected', x === b));
  const f = b.dataset.f;
  $$('.pcard').forEach(c => c.classList.toggle('out', f !== 'all' && c.dataset.cat !== f));
}));

/* quick view */
const modal = $('[data-qv-modal]'), form = $('[data-qv-form]'), stage = $('[data-qv-stage]');
let studio = null, cur = null, qty = 1, opener = null;
async function getStudio() {
  if (studio) return studio;
  const m = await import('./furniture3d.js');
  studio = m.createStudio(); studio.mount(stage); return studio;
}
function opts() { const f = new FormData(form); return { wood: f.get('wood'), finish: f.get('finish'), fabricColor: f.get('fabric'), upholstered: f.get('uph') === '1' }; }
function price() { const o = opts(), p = INFO[cur]; return (p.price * WOODK[o.wood] + FINK[o.finish] + (cur === 'chair' && o.upholstered ? 60 : 0)) * qty; }
function upd(rebuild = true) {
  const o = opts(), p = INFO[cur];
  $('[data-qv-price]').textContent = eur(Math.round(price() / 10) * 10);
  $('[data-qty-n]').textContent = qty;
  $('[data-qv-fabname]').textContent = FABN[o.fabricColor];
  $('[data-qv-fab]').hidden = !(p.fab === 1 || (p.fab === 'opt' && o.upholstered));
  if (rebuild && studio) studio.show(cur, { ...o, resetYaw: false });
}
async function open(key) {
  cur = key; qty = key === 'chair' ? 4 : 1; opener = document.activeElement;
  const p = INFO[key];
  $('[data-qv-name]').textContent = NAME[key]; $('[data-qv-cat]').textContent = p.cat; $('[data-qv-desc]').textContent = p.desc;
  $('[data-qv-meta]').textContent = `${p.dims} · ready in ${p.weeks} weeks`;
  $('[data-qv-uph]').hidden = key !== 'chair';
  form.reset(); upd(false);
  modal.hidden = false; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { modal.classList.add('open'); $('.qv__x', modal).focus(); });
  stage.classList.remove('ready');
  const s = await getStudio(); s.setVisible(true); await s.show(key, { ...opts(), resetYaw: true });
  setTimeout(() => stage.classList.add('ready'), 250);
}
function close() { modal.classList.remove('open'); document.body.style.overflow = ''; studio?.setVisible(false); setTimeout(() => modal.hidden = true, 450); opener?.focus?.(); }
$$('[data-qv]').forEach(b => b.addEventListener('click', () => open(b.dataset.qv)));
$$('[data-qv-close]').forEach(b => b.addEventListener('click', close));
addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
form.addEventListener('input', () => upd());
$$('[data-qty]').forEach(b => b.addEventListener('click', () => { qty = Math.max(1, Math.min(20, qty + +b.dataset.qty)); upd(false); }));
stage.addEventListener('pointerdown', () => setTimeout(() => stage.classList.add('touched'), 400));

// AR
$('[data-qv-ar]').addEventListener('click', async () => {
  const note = $('[data-qv-note]'); const a = document.createElement('a');
  if (!(a.relList && a.relList.supports && a.relList.supports('ar'))) { note.hidden = false; note.textContent = 'Open this page on an iPhone or iPad to place it in your room at real size.'; setTimeout(() => note.hidden = true, 4500); return; }
  const blob = await (await getStudio()).usdz();
  a.rel = 'ar'; a.href = URL.createObjectURL(blob); a.download = 'nendre.usdz'; a.innerHTML = '<img alt="">'; document.body.append(a); a.click(); setTimeout(() => a.remove(), 1000);
});

/* order list */
let list = []; try { list = JSON.parse(localStorage.getItem('nendre-list') || '[]'); } catch { }
const save = () => { try { localStorage.setItem('nendre-list', JSON.stringify(list)); } catch { } };
const drawer = $('[data-drawer]');
function render() {
  const n = list.reduce((a, l) => a + l.qty, 0), tot = list.reduce((a, l) => a + l.total, 0);
  $$('[data-ocount]').forEach(b => { if (b.textContent !== String(n)) { b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } });
  $('[data-otot]').textContent = eur(tot);
  const bt = $('[data-ototal-bar]'); if (bt) bt.textContent = n ? `${n} · ${eur(tot)}` : 'empty';
  $('[data-olist]').innerHTML = list.length ? list.map((l, i) => `<li><img src="img/${l.img}-800.webp" alt=""><div><h4>${l.qty > 1 ? l.qty + ' × ' : ''}${l.name}</h4><small>${l.spec}</small><button class="rm" type="button" data-rm="${i}">Remove</button></div><span class="lp">${eur(l.total)}</span></li>`).join('')
    : '<li class="empty">Nothing here yet.<br>Open any piece and add it.</li>';
  writeTA();
}
$('[data-olist]').addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { list.splice(+r.dataset.rm, 1); save(); render(); } });
$('[data-qv-add]').addEventListener('click', () => {
  const o = opts(), p = INFO[cur];
  const spec = [o.wood[0].toUpperCase() + o.wood.slice(1), { natural: 'natural oil', white: 'white oil', dark: 'dark oil' }[o.finish], (p.fab === 1 || (p.fab === 'opt' && o.upholstered)) ? FABN[o.fabricColor] : ''].filter(Boolean).join(', ');
  list.push({ key: cur, name: NAME[cur], img: cur, qty, spec, total: Math.round(price() / 10) * 10 }); save(); render();
  const b = $('[data-qv-add]'); b.textContent = 'Added ✓'; setTimeout(() => b.textContent = 'Add to order list', 1400);
  setTimeout(() => { close(); openList(); }, 500);
});
function openList() { drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add('open')); document.body.style.overflow = 'hidden'; }
function closeList() { drawer.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => drawer.hidden = true, 550); }
$$('[data-list-open]').forEach(b => b.addEventListener('click', openList));
$$('[data-list-close]').forEach(b => b.addEventListener('click', closeList));
$('[data-list-quote]').addEventListener('click', () => { closeList(); const s = $('#o-what'); if (s) s.value = 'Request a quote for my order list'; });
addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeList(); });
function writeTA() { const ta = $('[data-cfg-text]'); if (!ta) return; ta.value = (window.__cfgText ? 'Table: ' + window.__cfgText : '') + (list.length ? '\n' + list.map(l => `${l.qty} × ${l.name}, ${l.spec}`).join('\n') : ''); ta.rows = Math.min(8, 1 + list.length); }
document.addEventListener('cfgtext', writeTA);
render();
