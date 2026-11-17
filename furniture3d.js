// Nendrė — procedural collection: chairs, bench, coffee table, sideboard, wardrobe, bookshelf, bed, sofa, armchair
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { RoundedBoxGeometry } from './lib/RoundedBoxGeometry.js';

const TOUCH = matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
const LOW = TOUCH || (navigator.hardwareConcurrency || 8) <= 4;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const WOOD = {
  oak:    { rot: Math.PI / 2, rough: .62, tint: 0xffffff },
  ash:    { rot: 0, rough: .66, tint: 0xfffdf8 },
  walnut: { rot: Math.PI / 2, rough: .5, tint: 0x8c7d74 },
};
export const FABRIC = { oat: 0xd9cfbd, moss: 0x5f6b4e, rust: 0xa65a3a, charcoal: 0x3b3b3a, sky: 0x9fb3bf };

/* ---------------- product catalogue (dimensions in metres) ---------------- */
export const PRODUCTS = {
  chair:    { name: 'Rasa dining chair', cat: 'seating', price: 390, fabric: 'optional', dims: '46 × 52 × 79 cm', cam: { d: 1.0, y: .42, elev: .2, yaw: -.7 } },
  bench:    { name: 'Suolas bench', cat: 'seating', price: 690, dims: '160 × 36 × 45 cm', cam: { d: 1.5, y: .25, elev: .26, yaw: -.62 } },
  sofa:     { name: 'Debesis sofa', cat: 'seating', price: 3900, fabric: true, dims: '220 × 92 × 78 cm', cam: { d: 2.0, y: .38, elev: .2, yaw: -.55 } },
  armchair: { name: 'Debesis lounge chair', cat: 'seating', price: 1650, fabric: true, dims: '84 × 88 × 78 cm', cam: { d: 1.25, y: .38, elev: .2, yaw: -.7 } },
  coffee:   { name: 'Sala coffee table', cat: 'tables', price: 890, dims: '120 × 60 × 38 cm', cam: { d: 1.35, y: .2, elev: .32, yaw: -.6 } },
  sideboard:{ name: 'Komoda sideboard', cat: 'storage', price: 2450, dims: '180 × 45 × 78 cm', cam: { d: 2.0, y: .42, elev: .14, yaw: -.5 } },
  wardrobe: { name: 'Spinta wardrobe', cat: 'storage', price: 3200, dims: '120 × 60 × 210 cm', cam: { d: 2.6, y: 1.0, elev: .1, yaw: -.5 } },
  shelf:    { name: 'Lentyna bookcase', cat: 'storage', price: 1290, dims: '90 × 35 × 190 cm', cam: { d: 2.4, y: .95, elev: .1, yaw: -.5 } },
  table:    { name: 'Nendrė dining table', cat: 'tables', price: 1290, dims: '160–280 × 90–110 cm', cam: { d: 3, y: .4, elev: .23, yaw: -.62 } },
  bed:      { name: 'Sapnas bed', cat: 'bedroom', price: 2690, fabric: true, dims: '160 × 200 cm mattress', cam: { d: 2.9, y: .45, elev: .3, yaw: -.75 } },
};

export function createStudio({ alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.className = 'gl'; canvas.style.touchAction = 'pan-y';

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .42;
  const camera = new THREE.PerspectiveCamera(28, 1, .05, 60);
  const key = new THREE.DirectionalLight(0xfff1de, 2.9); key.position.set(-2.6, 5.2, 2.8); key.castShadow = true;
  key.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.8, bottom: -2.6, near: 1, far: 14 });
  key.shadow.radius = 6; key.shadow.bias = -.0004; key.shadow.normalBias = .02; scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, .55); fill.position.set(3, 2, -2); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, .35));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: .2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const aoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(30,24,18,.5)'); gr.addColorStop(.55, 'rgba(30,24,18,.16)'); gr.addColorStop(1, 'rgba(30,24,18,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: .75 }));
  ao.rotation.x = -Math.PI / 2; ao.position.y = .001; scene.add(ao);

  /* textures */
  const loader = new THREE.TextureLoader(), cache = {};
  const tex = w => cache[w] || (cache[w] = Promise.all([[`${w}_d${LOW ? 1 : 2}.webp`, 1], [`${w}_r.webp`], [`${w}_n.webp`]].map(([f, s]) => new Promise(res => loader.load('tex/' + f, t => { if (s) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; res(t); }, undefined, () => res(null))))).then(([map, rough, nor]) => ({ map, rough, nor })));
  const fabricTex = (() => { // a fine woven bump, tileable
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const d = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const w = ((x >> 1) + (y >> 1)) & 1, n = Math.random() * 40; const v = 150 + (w ? 40 : -10) + n + Math.sin(y * .7) * 10; const i = (y * 256 + x) * 4; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); return t; })();

  const M = {
    wood: new THREE.MeshStandardMaterial({ roughness: .62 }),
    woodH: new THREE.MeshStandardMaterial({ roughness: .62 }), // grain along X
    fabric: new (LOW ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial)({ color: FABRIC.oat, roughness: .95, bumpMap: fabricTex, bumpScale: .6, ...(LOW ? {} : { sheen: .6, sheenRoughness: .8, sheenColor: new THREE.Color(0xffffff) }) }),
    linen: new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: .95, bumpMap: fabricTex, bumpScale: .4 }),
    cushionB: new THREE.MeshStandardMaterial({ color: 0xa65a3a, roughness: .95, bumpMap: fabricTex, bumpScale: .5 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: .5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: .35, metalness: .9 }),
    book: [0x7b8a74, 0xc9b79c, 0x3e4a56, 0xa65a3a, 0xe2ddd2, 0x5b4637].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 })),
  };
  async function setWood(w, finish = 'natural') {
    const t = await tex(w), wd = WOOD[w];
    const tint = new THREE.Color(wd.tint).multiply(new THREE.Color({ natural: 0xffffff, white: 0xfff6ea, dark: 0x9a8a7c }[finish]));
    [[M.wood, wd.rot + Math.PI / 2], [M.woodH, wd.rot]].forEach(([m, r]) => {
      const mp = t.map.clone(); mp.needsUpdate = true; mp.center.set(.5, .5); mp.rotation = r;
      m.map = mp; m.roughnessMap = t.rough; m.normalMap = t.nor; m.normalScale = new THREE.Vector2(.3, .3); m.roughness = wd.rough; m.color.copy(tint); m.needsUpdate = true;
    });
  }
  function setFabric(f) { M.fabric.color.set(FABRIC[f] || FABRIC.oat); }

  /* geometry helpers */
  // UVs in metres, so the grain has the same scale on a leg and on a wardrobe side
  const worldUV = (g, w, h, d, k = 1.1) => { const n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let su, sv; if (ax >= ay && ax >= az) { su = d; sv = h; } else if (ay >= az) { su = w; sv = d; } else { su = w; sv = h; }
      uv.setXY(i, uv.getX(i) * su / k + w * .37, uv.getY(i) * sv / k + d * .53); }
    uv.needsUpdate = true; return g; };
  const B = (w, h, d, m = M.woodH, r = .004) => { const g = worldUV(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), w, h, d); const b = new THREE.Mesh(g, m); b.castShadow = b.receiveShadow = true; return b; };
  const V = (w, h, d, r) => B(w, h, d, M.wood, r); // vertical grain
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const taper = (top, bot, h, m = M.wood) => { const g = worldUV(new RoundedBoxGeometry(top, h, top, 2, .003), top, h, top), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = (p.getY(i) + h / 2) / h, s = (bot + (top - bot) * k) / top; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
    g.computeVertexNormals(); const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };
  const cushion = (w, h, d, r = .05) => B(w, h, d, M.fabric, r);
  const legs4 = (g, x, z, h, top = .045, bot = .03, splay = .04) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = taper(top, bot, h); at(l, sx * x, h / 2, sz * z); l.rotation.z = -sx * splay; l.rotation.x = sz * splay * .7; g.add(l); } };

  const build = {
    chair(o) {
      const g = new THREE.Group(), sh = .45, w = .46, d = .46;
      for (const sx of [-1, 1]) {
        const f = taper(.036, .028, sh - .02); at(f, sx * (w / 2 - .03), (sh - .02) / 2, d / 2 - .03); f.rotation.z = -sx * .03; g.add(f);
        const back = taper(.034, .03, .82); at(back, sx * (w / 2 - .03), .41, -d / 2 + .04); back.rotation.x = -.09; g.add(back);
      }
      const seat = o.fabric ? cushion(w, .06, d, .02) : B(w, .032, d, M.woodH, .01); at(seat, 0, sh, 0); g.add(seat);
      if (o.fabric) { const base = B(w, .02, d); at(base, 0, sh - .035, 0); g.add(base); }
      // curved back rail
      const shape = new THREE.Shape(); const R = .9, a0 = -.26, a1 = .26;
      for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; const x = Math.sin(a) * R, z = Math.cos(a) * R - R; i ? shape.lineTo(x, z) : shape.moveTo(x, z); }
      for (let i = 20; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 20; const x = Math.sin(a) * (R - .022), z = Math.cos(a) * (R - .022) - R + .022; shape.lineTo(x, z); }
      const rg = new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2 }); rg.rotateX(Math.PI / 2);
      const rail = new THREE.Mesh(rg, M.woodH); rail.castShadow = true; at(rail, 0, .80, -d / 2 + .02); rail.rotation.x = -.09; g.add(rail);
      for (const z of [d / 2 - .03, -d / 2 + .04]) { const s = B(w - .07, .02, .018); at(s, 0, .16, z); g.add(s); }
      for (const sx of [-1, 1]) { const s = B(.018, .02, d - .08); at(s, sx * (w / 2 - .03), .22, 0); g.add(s); }
      return g;
    },
    bench() {
      const g = new THREE.Group(), L = 1.6, D = .36, H = .45;
      g.add(at(B(L, .045, D, M.woodH, .01), 0, H - .022, 0));
      for (const sx of [-1, 1]) { const x = sx * (L / 2 - .2);
        for (const sz of [-1, 1]) { const l = taper(.045, .032, H - .045); at(l, x + sx * .02, (H - .045) / 2, sz * (D / 2 - .06)); l.rotation.x = sz * .1; l.rotation.z = -sx * .06; g.add(l); }
        g.add(at(B(.03, .04, D - .06), x, H - .07, 0)); }
      g.add(at(B(L - .5, .035, .03), 0, .14, 0));
      return g;
    },
    coffee() {
      const g = new THREE.Group(), L = 1.2, D = .6, H = .38;
      g.add(at(B(L, .035, D, M.woodH, .03), 0, H - .018, 0));
      g.add(at(B(L - .16, .022, D - .14, M.woodH, .01), 0, .1, 0));
      legs4(g, L / 2 - .09, D / 2 - .08, H - .035, .05, .04, .02);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.11, .07, .07, 40, 1, true), M.ceramic); bowl.material.side = THREE.DoubleSide; bowl.castShadow = true; at(bowl, .25, H + .035, -.05); g.add(bowl);
      M.book.slice(0, 3).forEach((m, i) => { const b = B(.24 - i * .02, .025, .17 - i * .01, m, .003); at(b, -.28, H + .013 + i * .026, .02); b.rotation.y = .12 * i - .1; g.add(b); });
      return g;
    },
    sideboard() {
      const g = new THREE.Group(), W = 1.8, D = .45, H = .78, lh = .16, ch = H - lh;
      g.add(at(B(W, .028, D + .01, M.woodH, .006), 0, H - .014, 0));
      g.add(at(B(W - .02, ch - .028, D - .02), 0, lh + (ch - .028) / 2, 0));
      for (const sx of [-1, 1]) g.add(at(V(.022, ch - .03, D), sx * (W / 2 - .011), lh + (ch - .03) / 2, 0));
      g.add(at(B(W, .022, D), 0, lh + .011, 0));
      // four slatted doors
      const dw = (W - .06) / 4, n = 9;
      for (let k = 0; k < 4; k++) { const cx = -W / 2 + .03 + dw * (k + .5);
        for (let i = 0; i < n; i++) { const s = B(dw / n - .004, ch - .07, .016, M.wood, .004); at(s, cx - dw / 2 + dw / n * (i + .5), lh + ch / 2, D / 2 + .004); g.add(s); }
        const h = B(.012, .09, .02, M.brass, .004); at(h, cx + (k % 2 ? -1 : 1) * (dw / 2 - .03), lh + ch / 2 + .08, D / 2 + .02); g.add(h); }
      legs4(g, W / 2 - .08, D / 2 - .07, lh, .04, .03, .02);
      const vase = new THREE.Mesh(new THREE.LatheGeometry([[.0, 0], [.07, 0], [.09, .08], [.06, .2], [.035, .27], [.04, .3]].map(p => new THREE.Vector2(...p)), 40), M.ceramic); vase.castShadow = true; at(vase, -.5, H, 0); g.add(vase);
      M.book.slice(3).forEach((m, i) => { const b = B(.03, .24 - i * .02, .17, m, .003); at(b, .45 + i * .034, H + .12 - i * .01, 0); g.add(b); });
      return g;
    },
    wardrobe() {
      const g = new THREE.Group(), W = 1.2, D = .6, H = 2.1, pl = .08;
      g.add(at(V(W, H - pl, D - .02), 0, pl + (H - pl) / 2, 0));
      g.add(at(B(W - .06, pl, D - .08, M.woodH, .003), 0, pl / 2, -.02));
      const dw = (W - .012) / 2;
      for (const sx of [-1, 1]) {
        const door = B(dw, H - pl - .02, .022, M.wood, .004); at(door, sx * (dw / 2 + .003), pl + (H - pl) / 2, D / 2); g.add(door);
        for (let i = 1; i < 4; i++) { const gr = B(.004, H - pl - .2, .004, new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: .25 })); at(gr, sx * (dw / 2 + .003) - dw / 2 + dw * i / 4, pl + (H - pl) / 2, D / 2 + .011); g.add(gr); }
        const hd = B(.022, .32, .03, M.woodH, .008); at(hd, sx * .045, 1.05, D / 2 + .022); g.add(hd);
      }
      return g;
    },
    shelf() {
      const g = new THREE.Group(), W = .9, D = .35, H = 1.9, t = .028, n = 5;
      for (const sx of [-1, 1]) g.add(at(V(t, H, D), sx * (W / 2 - t / 2), H / 2, 0));
      for (let i = 0; i <= n; i++) { const y = .06 + (H - .08) * i / n; g.add(at(B(W - 2 * t, t, D - .01, M.woodH, .003), 0, y, 0)); }
      g.add(at(B(W - 2 * t, .05, .02), 0, .03, D / 2 - .02));
      let seed = 3; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) { const y0 = .06 + (H - .08) * i / n + t / 2; let x = -W / 2 + t + .02; const end = W / 2 - t - (i % 2 ? .3 : .06);
        while (x < end) { const bw = .02 + rnd() * .03, bh = .2 + rnd() * .12; if (x + bw > end) break; const b = B(bw, bh, .2 + rnd() * .04, M.book[(rnd() * 6) | 0], .002); at(b, x + bw / 2, y0 + bh / 2, -.02); g.add(b); x += bw + .002; }
        if (i % 2) { const v = new THREE.Mesh(new THREE.SphereGeometry(.07, 32, 16), M.ceramic); v.scale.y = 1.2; v.castShadow = true; at(v, W / 2 - .18, y0 + .085, 0); g.add(v); } }
      return g;
    },
    bed() {
      const g = new THREE.Group(), W = 1.6, L = 2.0, fw = W + .08, fl = L + .06, rh = .3;
      for (const sx of [-1, 1]) g.add(at(B(.04, .18, fl), sx * (fw / 2 - .02), rh, 0));
      g.add(at(B(fw, .18, .04), 0, rh, fl / 2 - .02));
      legs4(g, fw / 2 - .05, fl / 2 - .06, rh - .09, .06, .05, 0);
      // headboard: vertical slats
      const hb = .95, n = 15; for (let i = 0; i < n; i++) { const s = B(fw / n - .012, hb - .2, .03, M.wood, .006); at(s, -fw / 2 + fw / n * (i + .5), .2 + (hb - .2) / 2, -fl / 2 - .02); g.add(s); }
      g.add(at(B(fw + .04, .04, .06, M.woodH, .01), 0, hb + .02, -fl / 2 - .02));
      const mat = cushion(W, .22, L, .05); mat.material = M.linen; at(mat, 0, rh + .13, .01); g.add(mat);
      const duvet = cushion(W + .06, .08, L * .66, .04); at(duvet, 0, rh + .26, .32); g.add(duvet);
      const fold = cushion(W + .06, .06, .22, .03); at(fold, 0, rh + .3, .32 - L * .33 + .1); g.add(fold);
      for (const sx of [-1, 1]) { const p = B(.64, .15, .44, M.linen, .045); at(p, sx * .37, rh + .33, -L / 2 + .26); p.rotation.x = -.5; g.add(p); }
      const thr = cushion(.5, .13, .34, .05); at(thr, .1, rh + .36, -L / 2 + .5); thr.rotation.set(-.35, .15, 0); thr.material = M.cushionB; g.add(thr);
      return g;
    },
    sofa(o, W = 2.2) {
      const g = new THREE.Group(), D = .92, base = .2;
      g.add(at(B(W, .06, D, M.woodH, .01), 0, base + .03, 0));
      legs4(g, W / 2 - .08, D / 2 - .08, base, .045, .035, .02);
      for (const sx of [-1, 1]) { const arm = B(.06, .42, D, M.woodH, .015); at(arm, sx * (W / 2 - .03), base + .27, 0); g.add(arm); }
      const back = B(W - .12, .38, .1, M.woodH, .01); at(back, 0, base + .25, -D / 2 + .05); g.add(back);
      const n = W > 1.5 ? 3 : 1, cw = (W - .14) / n;
      for (let i = 0; i < n; i++) { const x = -W / 2 + .07 + cw * (i + .5);
        g.add(at(cushion(cw - .01, .17, D - .16, .06), x, base + .145, .05));
        const bc = cushion(cw - .02, .44, .16, .07); at(bc, x, base + .43, -D / 2 + .17); bc.rotation.x = -.18; g.add(bc); }
      return g;
    },
    armchair(o) { return build.sofa(o, .84); },
    table(o) {
      const g = new THREE.Group(), L = o.L || 2.2, Wd = o.W || 1.0, H = .75, T = .04;
      if (o.shape === 'oval') { const s = new THREE.Shape(), n = 3.2; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); const x = L / 2 * Math.sign(c) * Math.abs(c) ** (2 / n), y = Wd / 2 * Math.sign(sn) * Math.abs(sn) ** (2 / n); i ? s.lineTo(x, y) : s.moveTo(x, y); }
        const tg = new THREE.ExtrudeGeometry(s, { depth: T - .008, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 3 }); tg.rotateX(-Math.PI / 2);
        const p = tg.attributes.position, uv = tg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.1, p.getZ(i) / 1.1); tg.computeVertexNormals();
        const top = new THREE.Mesh(tg, M.woodH); top.castShadow = top.receiveShadow = true; at(top, 0, H - T + .004, 0); g.add(top); }
      else g.add(at(B(L, T, Wd, M.woodH, .006), 0, H - T / 2, 0));
      if (o.base === 'steel') { const px = L / 2 - .2, d = Wd - .14;
        for (const sx of [-1, 1]) { const sm = M.steel || (M.steel = new THREE.MeshStandardMaterial({ color: 0x1d1d1c, roughness: .42, metalness: .75 }));
          g.add(at(B(.05, .022, d, sm, .003), sx * px, H - T - .011, 0), at(B(.05, .022, d, sm, .003), sx * px, .011, 0), at(B(.05, H - T, .022, sm, .003), sx * px, (H - T) / 2, d / 2 - .011), at(B(.05, H - T, .022, sm, .003), sx * px, (H - T) / 2, -d / 2 + .011)); } }
      else { const x = L / 2 - .14, z = Wd / 2 - .1; legs4(g, x, z, H - T, .062, .036, .035);
        for (const sz of [-1, 1]) g.add(at(B(2 * x - .06, .085, .024), 0, H - T - .044, sz * z));
        for (const sx of [-1, 1]) g.add(at(B(.024, .085, 2 * z - .06), sx * x, H - T - .044, 0)); }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.13, .08, .08, 40, 1, true), M.ceramic); bowl.material.side = THREE.DoubleSide; bowl.castShadow = true; at(bowl, L * .16, H + .04, -Wd * .08); g.add(bowl);
      return g;
    },
  };

  /* state, camera, drag, on-demand render */
  let item = null, kind = null, yaw = -.6, vel = 0, auto = 0, dist = 2, elev = .2, look = new THREE.Vector3(), host = null, visible = true, running = false, needs = true, paused = false;
  async function show(k, opts = {}) {
    const P = PRODUCTS[k]; kind = k;
    await setWood(opts.wood || 'oak', opts.finish); setFabric(opts.fabricColor || 'oat');
    if (item) { scene.remove(item); item.traverse(o => o.geometry?.dispose?.()); }
    item = build[k]({ fabric: opts.upholstered, ...opts }); scene.add(item);
    const box = new THREE.Box3().setFromObject(item), s = box.getSize(new THREE.Vector3());
    ao.scale.set(s.x * 1.4 + .2, s.z * 1.6 + .2, 1); ao.position.x = (box.min.x + box.max.x) / 2;
    const c = P.cam; elev = c.elev; if (opts.resetYaw !== false) yaw = c.yaw; frameTo(box);
    kick();
  }
  let lastBox = null;
  function frameTo(box) {
    lastBox = box || lastBox; if (!lastBox) return;
    const sph = lastBox.getBoundingSphere(new THREE.Sphere()), fv = camera.fov * Math.PI / 180, fh = 2 * Math.atan(Math.tan(fv / 2) * camera.aspect);
    dist = sph.radius / Math.sin(Math.min(fv, fh) / 2) * .95; look.copy(sph.center);
  }
  function place() { camera.position.set(Math.sin(yaw) * dist * Math.cos(elev), look.y + Math.sin(elev) * dist, Math.cos(yaw) * dist * Math.cos(elev)); camera.lookAt(look); }
  const kick = () => { needs = true; if (!running && visible) { running = true; requestAnimationFrame(loop); } };
  let last = 0;
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; let moving = false;
    if (!dragging) { if (Math.abs(vel) > .0004) { yaw += vel; vel *= .93; moving = true; } else if (host?.dataset.spin && !RM && !paused) { auto = Math.min(1, auto + dt * .5); yaw += .1 * dt * auto; moving = true; } }
    if (moving || needs) { place(); renderer.render(scene, camera); needs = false; }
    if (moving || dragging) requestAnimationFrame(loop); else running = false;
  }
  let dragging = false, pending = false, px = 0, py = 0, lastX = 0, lastT = 0;
  canvas.addEventListener('pointerdown', e => { pending = true; px = lastX = e.clientX; py = e.clientY; lastT = performance.now(); if (e.pointerType === 'mouse') start(); });
  function start() { pending = false; dragging = true; vel = 0; auto = 0; kick(); }
  addEventListener('pointermove', e => { if (pending) { const dx = Math.abs(e.clientX - px), dy = Math.abs(e.clientY - py); if (dx > 8 && dx > dy * 1.3) start(); else if (dy > 8) pending = false; else return; }
    if (!dragging) return; const dx = e.clientX - lastX; yaw -= dx * .006; const now = performance.now(); vel = -dx * .006 * Math.min(1, 16 / Math.max(1, now - lastT)); lastX = e.clientX; lastT = now; needs = true; });
  const up = () => { pending = false; if (dragging) { dragging = false; kick(); } };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  function size() { if (!host) return; const r = host.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); frameTo(); needs = true; }
  const ro = new ResizeObserver(() => { size(); kick(); });
  function mount(el) { if (host) ro.unobserve(host); host = el; el.prepend(canvas); ro.observe(el); size(); kick(); }
  async function usdz() {
    const { USDZExporter } = await import('./lib/USDZExporter.js');
    const data = await new USDZExporter().parseAsync(item);
    return new Blob([data], { type: 'model/vnd.usdz+zip' });
  }
  async function snapshot(k, opts, w, h) { // for catalogue renders
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); host = null;
    await show(k, { ...opts, resetYaw: true }); await new Promise(r => setTimeout(r, 50)); place(); renderer.render(scene, camera); return canvas.toDataURL('image/png');
  }
  return { canvas, mount, show, kick, usdz, snapshot, setVisible: v => { visible = v; if (v) kick(); }, pause: v => { paused = v; if (!v) kick(); }, renderer };
}
