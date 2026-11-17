// Nendrė — procedural solid-wood table viewer (one renderer, moved between stages)
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { RoundedBoxGeometry } from './lib/RoundedBoxGeometry.js';

const TOUCH = matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
const LOW = TOUCH || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const WOODS = {
  oak:    { name: 'European oak', rot: Math.PI / 2, rough: .62, tint: 0xffffff },
  ash:    { name: 'Ash', rot: 0, rough: .66, tint: 0xfffdf8 },
  walnut: { name: 'European walnut', rot: Math.PI / 2, rough: .5, tint: 0x8c7d74 },
};
const FINISH = { natural: 0xffffff, white: 0xfff6ea, dark: 0x9a8a7c };

export function createViewer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const QS = new URLSearchParams(location.search);
  renderer.shadowMap.enabled = !QS.has('noshadow');
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'gl';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = .42;

  const camera = new THREE.PerspectiveCamera(28, 1, .1, 60);
  const key = new THREE.DirectionalLight(0xfff1de, 2.9);
  key.position.set(-2.6, 5.2, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 14 });
  key.shadow.radius = 6; key.shadow.blurSamples = 16; key.shadow.bias = -0.0004; key.shadow.normalBias = .02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, .55); fill.position.set(3, 2, -2); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, .35));

  // floor: soft shadow + contact darkening
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: .22 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ao = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(30,24,18,.55)'); gr.addColorStop(.55, 'rgba(30,24,18,.18)'); gr.addColorStop(1, 'rgba(30,24,18,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: .8 }));
    m.rotation.x = -Math.PI / 2; m.position.y = .001; scene.add(m); return m;
  })();

  // ---------- textures ----------
  const loader = new THREE.TextureLoader();
  const texCache = {};
  const src = (w) => {
    if (texCache[w]) return texCache[w];
    const big = !LOW;
    const load = (f, srgb) => new Promise(res => loader.load('tex/' + f, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); res(t); }, undefined, () => res(null)));
    return texCache[w] = Promise.all([load(`${w}_d${big ? 2 : 1}.webp`, true), load(`${w}_r.webp`), load(`${w}_n.webp`)]).then(([map, rough, nor]) => ({ map, rough, nor }));
  };

  // glued-panel top: strips cut from the source at random offsets, rotated so the grain runs along the length
  function staveCanvas(img, rot, L, W, seed) {
    const S = LOW ? 1024 : 2048, c = document.createElement('canvas');
    c.width = S; c.height = Math.round(S * W / L * 1.6); const g = c.getContext('2d');
    // source oriented so grain is horizontal
    const o = document.createElement('canvas'); o.width = img.width; o.height = img.height; const og = o.getContext('2d');
    if (rot) { og.translate(o.width / 2, o.height / 2); og.rotate(rot); og.drawImage(img, -img.width / 2, -img.height / 2); } else og.drawImage(img, 0, 0);
    let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const boards = Math.max(4, Math.round(W / .14)), bh = c.height / boards;
    for (let i = 0; i < boards; i++) {
      const srcH = o.height * (W / boards) / 1.0, sy = rnd() * (o.height - srcH), flip = rnd() > .5;
      g.save(); g.translate(0, i * bh);
      if (flip) { g.translate(S, 0); g.scale(-1, 1); }
      g.drawImage(o, rnd() * o.width * .2, sy, o.width * .8, srcH, 0, 0, S, bh + 1);
      g.restore();
      g.fillStyle = `rgba(${rnd() > .5 ? '255,250,240' : '40,25,10'},${.02 + rnd() * .05})`; g.fillRect(0, i * bh, S, bh);
      g.fillStyle = 'rgba(40,24,10,.16)'; g.fillRect(0, i * bh, S, 1.2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }

  // ---------- table ----------
  const table = new THREE.Group(); scene.add(table);
  const parts = { top: null, base: new THREE.Group(), tenons: new THREE.Group() };
  table.add(parts.base, parts.tenons);
  const mats = {
    wood: new THREE.MeshStandardMaterial({ roughness: .62, metalness: 0 }),
    top: new THREE.MeshStandardMaterial({ roughness: .58, metalness: 0 }),
    end: new THREE.MeshStandardMaterial({ roughness: .8, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x1d1d1c, roughness: .42, metalness: .75 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: .5 }),
    tenon: new THREE.MeshStandardMaterial({ roughness: .7 }),
  };
  // a ceramic bowl for scale
  const bowl = (() => {
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(.025 + .1 * Math.sin(t * Math.PI / 2) ** .8, .1 * (1 - Math.cos(t * Math.PI / 2)))); }
    for (let i = 14; i >= 0; i--) { const t = i / 14; pts.push(new THREE.Vector2(.02 + .093 * Math.sin(t * Math.PI / 2) ** .8, .008 + .094 * (1 - Math.cos(t * Math.PI / 2)))); }
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mats.ceramic); m.castShadow = true; return m;
  })();
  table.add(bowl);

  const state = { wood: 'oak', L: 2.2, W: 1.0, shape: 'rect', base: 'taper', finish: 'natural', explode: 0 };
  const H = .75, T = .04;

  function shapePath(L, W, kind) {
    const s = new THREE.Shape(), x = L / 2, y = W / 2;
    if (kind === 'oval') {
      // a soft "boat" — superellipse
      const n = 3.2, N = 96;
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        const px = x * Math.sign(c) * Math.abs(c) ** (2 / n), py = y * Math.sign(sn) * Math.abs(sn) ** (2 / n);
        i ? s.lineTo(px, py) : s.moveTo(px, py); }
      return s;
    }
    const r = kind === 'soft' ? Math.min(.16, W * .2) : .012;
    s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y); return s;
  }
  function topGeo(L, W, kind) {
    const g = new THREE.ExtrudeGeometry(shapePath(L, W, kind), { depth: T - .008, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 3, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); g.translate(0, -T / 2 + .004, 0);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + L / 2) / L, 1 - (p.getZ(i) + W / 2) / W);
    uv.needsUpdate = true; g.computeVertexNormals(); return g;
  }
  const box = (w, h, d, m, r = .004) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m); b.castShadow = true; b.receiveShadow = true; return b; };
  const taperLeg = (top, bot, h, m) => {
    const g = new RoundedBoxGeometry(top, h, top, 2, .003); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = (p.getY(i) + h / 2) / h, s = (bot + (top - bot) * k) / top; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
    g.computeVertexNormals(); const mm = new THREE.Mesh(g, m); mm.castShadow = true; mm.receiveShadow = true; return mm;
  };

  let explodeTargets = [];
  function buildBase() {
    parts.base.clear(); parts.tenons.clear(); explodeTargets = [];
    const { L, W, base } = state, legH = H - T, w = mats.wood;
    const add = (mesh, out) => { parts.base.add(mesh); mesh.userData.home = mesh.position.clone(); mesh.userData.out = out; explodeTargets.push(mesh); };
    const tenon = (x, z, sx, sz) => { const t = box(sx, .045, sz, mats.tenon, .002); t.position.set(x, legH + .012, z); parts.tenons.add(t); t.userData.home = t.position.clone(); t.userData.out = new THREE.Vector3(0, .22, 0); explodeTargets.push(t); };
    if (base === 'taper') {
      const ix = Math.min(.1, L * .05), iz = .07, x = L / 2 - ix - .03, z = W / 2 - iz - .03, ins = state.shape === 'oval' ? .12 : 0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = taperLeg(.062, .036, legH, w); leg.position.set(sx * (x - ins), legH / 2, sz * (z - ins * .3)); leg.rotation.z = -sx * .035; leg.rotation.x = sz * .03;
        add(leg, new THREE.Vector3(sx * .28, -.05, sz * .22)); tenon(sx * (x - ins), sz * (z - ins * .3), .03, .03);
      }
      const ap = .085;
      for (const sz of [-1, 1]) { const a = box(2 * (x - ins) - .06, ap, .024, w); a.position.set(0, legH - ap / 2 - .002, sz * (z - ins * .3)); add(a, new THREE.Vector3(0, -.06, sz * .38)); }
      for (const sx of [-1, 1]) { const a = box(.024, ap, 2 * (z - ins * .3) - .06, w); a.position.set(sx * (x - ins), legH - ap / 2 - .002, 0); add(a, new THREE.Vector3(sx * .5, -.06, 0)); }
    } else if (base === 'panel') {
      const px = L / 2 - Math.max(.28, L * .14), pw = W - .26;
      for (const sx of [-1, 1]) {
        const g = new THREE.Shape(); const hw = pw / 2, fw = hw * .78;
        g.moveTo(-fw, 0); g.lineTo(fw, 0); g.lineTo(hw, legH - .05); g.lineTo(-hw, legH - .05); g.closePath();
        const ge = new THREE.ExtrudeGeometry(g, { depth: .045, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 2 });
        ge.translate(0, 0, -.0225); ge.rotateY(Math.PI / 2);
        const p = ge.attributes.position, uv = ge.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) / legH * .8, (p.getZ(i) + hw) / (2 * hw) * .4);
        const m = new THREE.Mesh(ge, w); m.castShadow = m.receiveShadow = true; m.position.set(sx * px, 0, 0); add(m, new THREE.Vector3(sx * .3, 0, 0));
        const cl = box(.07, .05, pw + .04, w); cl.position.set(sx * px, legH - .025, 0); add(cl, new THREE.Vector3(sx * .3, .12, 0));
        tenon(sx * px, 0, .025, pw * .6);
      }
      const st = box(2 * px, .07, .045, w); st.position.set(0, .22, 0); add(st, new THREE.Vector3(0, -.1, .25));
    } else {
      const px = L / 2 - Math.max(.16, L * .08), d = W - .14, tb = .05, tt = .022;
      for (const sx of [-1, 1]) {
        const grp = new THREE.Group();
        const top = box(tb, tt, d, mats.steel, .003); top.position.set(0, legH - tt / 2, 0);
        const bot = box(tb, tt, d, mats.steel, .003); bot.position.set(0, tt / 2, 0);
        const l1 = box(tb, legH, tt, mats.steel, .003); l1.position.set(0, legH / 2, d / 2 - tt / 2);
        const l2 = l1.clone(); l2.position.z = -d / 2 + tt / 2;
        grp.add(top, bot, l1, l2); grp.position.set(sx * px, 0, 0); grp.traverse(o => { o.castShadow = true; });
        add(grp, new THREE.Vector3(sx * .45, 0, 0));
      }
    }
  }
  let topTexKey = '';
  async function buildTop() {
    const { L, W, shape, wood } = state;
    if (parts.top) { table.remove(parts.top); parts.top.geometry.dispose(); }
    parts.top = new THREE.Mesh(topGeo(L, W, shape), mats.top); parts.top.castShadow = true; parts.top.receiveShadow = true;
    parts.top.position.y = H - T / 2; parts.top.userData.home = parts.top.position.clone(); parts.top.userData.out = new THREE.Vector3(0, .42, 0);
    table.add(parts.top);
    const k = wood + Math.round(L * 10) + Math.round(W * 10);
    if (k !== topTexKey) {
      topTexKey = k;
      const t = await src(wood); if (!t.map) return;
      if (topTexKey !== k) return;
      const old = mats.top.map; mats.top.map = staveCanvas(t.map.image, WOODS[wood].rot, L, W, 7 + L * 100); mats.top.needsUpdate = true; old?.dispose?.();
    }
    bowl.position.set(L * .16, H + .001, -W * .08);
    ao.scale.set(L * 1.25, W * 1.6, 1);
  }
  async function applyWood() {
    const t = await src(state.wood); const wd = WOODS[state.wood];
    const tint = new THREE.Color(wd.tint).multiply(new THREE.Color(FINISH[state.finish]));
    for (const m of [mats.wood, mats.end, mats.tenon]) {
      const mp = t.map.clone(); mp.needsUpdate = true; mp.rotation = wd.rot + Math.PI / 2; mp.center.set(.5, .5); mp.repeat.set(1, 1);
      m.map = mp; m.roughnessMap = t.rough; m.roughness = wd.rough + .05; m.normalMap = t.nor; m.normalScale = new THREE.Vector2(.35, .35); m.color.copy(tint); m.needsUpdate = true;
    }
    mats.tenon.color.copy(tint).multiplyScalar(1.12);
    mats.top.roughnessMap = t.rough; mats.top.roughness = wd.rough; mats.top.normalMap = t.nor; mats.top.normalScale = new THREE.Vector2(.25, .25); mats.top.color.copy(tint); mats.top.needsUpdate = true;
    kick();
  }

  let ready;
  async function set(next = {}) {
    const prev = { ...state }; Object.assign(state, next);
    const geo = prev.L !== state.L || prev.W !== state.W || prev.shape !== state.shape || prev.base !== state.base || !parts.top;
    const wood = prev.wood !== state.wood || prev.finish !== state.finish || !mats.top.map;
    if (geo || wood) { if (geo) { buildBase(); } await buildTop(); }
    if (wood || geo) await applyWood();
    applyExplode(); frame(); kick();
    if (!visible || !running) prewarm();
  }
  // compile shaders and upload textures off-screen (async where the GPU allows), so the first
  // time the table scrolls into view there is nothing left to prepare
  let warming = null;
  function prewarm() {
    if (warming) return warming;
    warming = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera)))
      .catch(() => {}).then(() => new Promise(r => setTimeout(r, 0))).then(() => { place(); renderer.render(scene, camera); needs = false; warming = null; });
    return warming;
  }

  // ---------- camera, drag-to-turn ----------
  let yaw = -.62, vel = 0, auto = 0, dist = 5.2, elev = .23;
  const look = new THREE.Vector3(0, .42, 0);
  function frame() {
    const span = Math.max(state.L, 1.6);
    const asp = camera.aspect || 1.6; dist = Math.max(3.2, span * 1.85 + .6) * Math.max(1, Math.min(1.7, 1.2 / Math.max(.5, asp))) * (host?.dataset.zoom ? +host.dataset.zoom : 1);
  }
  function place() {
    const e = state.explode, d = dist * (1 + .32 * e * e * (3 - 2 * e));
    camera.position.set(Math.sin(yaw) * d * Math.cos(elev), look.y + .12 * e + Math.sin(elev) * d, Math.cos(yaw) * d * Math.cos(elev));
    camera.lookAt(look);
  }
  function applyExplode() {
    const e = state.explode, k = e * e * (3 - 2 * e);
    for (const o of explodeTargets) o.position.copy(o.userData.home).addScaledVector(o.userData.out, k);
    if (parts.top) parts.top.position.copy(parts.top.userData.home).addScaledVector(parts.top.userData.out, k);
    bowl.position.y = H + .001 + .42 * k; bowl.visible = k < .02;
    parts.tenons.visible = k > .02;
  }

  // ---------- render loop on demand ----------
  let host = null, running = false, needs = true, visible = false, last = 0, labels = [], paused = false;
  const kick = () => { needs = true; if (!running && visible) { running = true; requestAnimationFrame(loop); } };
  function size() {
    if (!host) return; const r = host.getBoundingClientRect(); if (!r.width) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height;
    camera.fov = 28; camera.updateProjectionMatrix(); frame(); needs = true;
  }
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
    let moving = false;
    if (!dragging) {
      if (Math.abs(vel) > .0004) { yaw += vel; vel *= .93; moving = true; }
      else if (host?.dataset.spin && !RM && !paused) { auto = Math.min(1, auto + dt * .5); yaw += .09 * dt * auto; moving = true; }
    }
    if (tween) { moving = true; const k = Math.min(1, (t - tween.t0) / tween.d); state.explode = tween.a + (tween.b - tween.a) * (1 - (1 - k) ** 3); applyExplode(); if (k >= 1) tween = null; }
    if (moving || needs) {
      place(); renderer.render(scene, camera); needs = false;
      if (labels.length) placeLabels();
    }
    if (moving || dragging) requestAnimationFrame(loop); else running = false;
  }
  let tween = null;
  function explodeTo(b, d = 1200) { tween = { a: state.explode, b, t0: performance.now(), d: RM ? 1 : d }; kick(); }

  // drag: horizontal turns the table, vertical scrolls the page (touch-action: pan-y)
  let dragging = false, px = 0, lastX = 0, lastT = 0;
  canvas.style.touchAction = 'pan-y';
  // a touch only turns the table once it is clearly sideways; a vertical swipe is left to the page and draws nothing
  let pending = false, py = 0;
  canvas.addEventListener('pointerdown', e => { pending = true; px = lastX = e.clientX; py = e.clientY; lastT = performance.now(); if (e.pointerType === 'mouse') startDrag(); });
  function startDrag() { pending = false; dragging = true; vel = 0; auto = 0; host?.classList.add('grab'); kick(); }
  addEventListener('pointermove', e => {
    if (pending) { const dx = Math.abs(e.clientX - px), dy = Math.abs(e.clientY - py); if (dx > 8 && dx > dy * 1.3) startDrag(); else if (dy > 8) pending = false; else return; }
    if (!dragging) return; const dx = e.clientX - lastX; yaw -= dx * .006; const now = performance.now(); vel = -dx * .006 * Math.min(1, 16 / Math.max(1, now - lastT)); lastX = e.clientX; lastT = now; needs = true; });
  const up = () => { pending = false; if (!dragging) return; dragging = false; host?.classList.remove('grab'); kick(); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);

  // labels for the joinery view
  function placeLabels() {
    const r = host.getBoundingClientRect(), v = new THREE.Vector3();
    for (const l of labels) {
      v.copy(l.at()).project(camera);
      const w = l.w || (l.w = l.el.offsetWidth), x = Math.max(8, Math.min(r.width - w - 8, (v.x * .5 + .5) * r.width)), y = Math.max(10, Math.min(r.height - 120, (-v.y * .5 + .5) * r.height));
      l.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  function setLabels(list) { labels = list; kick(); }

  // ---------- mount / visibility ----------
  const io = new IntersectionObserver(es => { for (const e of es) if (e.target === host) { visible = e.isIntersecting; if (visible && (needs || host.dataset.spin)) wake(); } }, { rootMargin: '80px' });
  const wake = () => { if (!running && visible) { running = true; requestAnimationFrame(loop); } };
  let lastW = 0, lastH = 0;
  const ro = new ResizeObserver(es => { const r = es[0].contentRect; if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return; lastW = r.width; lastH = r.height; size(); kick(); });
  function mount(el) {
    if (host === el) return; if (host) { io.unobserve(host); ro.unobserve(host); }
    host = el; el.prepend(canvas); io.observe(el); ro.observe(el); frame(); size(); visible = true; kick();
  }

  // ---------- AR (iPhone Quick Look) ----------
  async function usdz() {
    const { USDZExporter } = await import('./lib/USDZExporter.js');
    const prevE = state.explode; state.explode = 0; applyExplode();
    const data = await new USDZExporter().parseAsync(table);
    state.explode = prevE; applyExplode();
    return new Blob([data], { type: 'model/vnd.usdz+zip' });
  }

  set().then(() => {
    const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
    idle(() => { const tmp = new THREE.Group(); for (const m of Object.values(mats)) { const x = new THREE.Mesh(new THREE.BoxGeometry(.01, .01, .01), m); x.castShadow = true; tmp.add(x); } scene.add(tmp); (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera))).catch(() => {}).then(() => scene.remove(tmp)); });
  });
  return {
    canvas, mount, set, state, kick, explodeTo, setLabels, usdz, LOW, TOUCH,
    pause: v => { paused = v; if (!v) wake(); },
    point: (name) => () => {
      const v = new THREE.Vector3(), k = state.explode * state.explode * (3 - 2 * state.explode);
      if (name === 'top') return v.set(-state.L * .25, H + .42 * k + .03, 0);
      if (name === 'tenon') { const t = parts.tenons.children[0]; return t ? t.getWorldPosition(v) : v; }
      if (name === 'leg') { const o = explodeTargets[0]; return o ? o.getWorldPosition(v).add(new THREE.Vector3(0, -.12, 0)) : v; }
      if (name === 'rail') { const o = explodeTargets.find(x => x.geometry && x.geometry.parameters && x.geometry.parameters.height < .1) || explodeTargets[explodeTargets.length - 1]; return o ? o.getWorldPosition(v) : v; }
      return v;
    },
  };
}
