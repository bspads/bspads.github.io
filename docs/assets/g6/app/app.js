import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { t, setLang, getLang, onLang, applyStatic } from './i18n.js';

// Цвета расцветок сняты пипеткой с фото из G6/*.png (sRGB). Материалы в GLB названы по роли
// детали (tools/02_build_glb.py), поэтому расцветка — это просто таблица цветов, без отдельных текстур.
const LETTERS = { letter_A: '#2bd94a', letter_B: '#ff3030', letter_X: '#19b5ff', letter_Y: '#ffe21a' };
const VARIANTS = {
  black: { body: '#1c1c1e', grip: '#18181a', inner: '#141415', btn: '#1b1b1d', stick_dome: '#1e1e20', stick_cap: '#232325',
           dpad: '#1e1e20', menu_btn: '#1e1e20', icon: '#8a8a8a', bumper: '#262628', trigger: '#262628', label: '#6a6a6a',
           paddle: '#1e1e20', switch: '#1e1e20', ...LETTERS, glow: 0.6 },
  gray:  { body: '#b9babc', grip: '#8f9092', inner: '#555', btn: '#3a3b3d', stick_dome: '#3a3b3d', stick_cap: '#3d3e40',
           dpad: '#4a4b4d', menu_btn: '#3a3b3d', icon: '#c8c8c8', bumper: '#2e2f31', trigger: '#2e2f31', label: '#888',
           paddle: '#2e2f31', switch: '#3a3b3d', ...LETTERS, glow: 0.6 },
  // задней стороны белой версии на фото нет: лопатки и переключатель — в цвет рукоятей (допущение)
  white: { body: '#efefef', grip: '#c9c9cb', inner: '#9a9a9a', btn: '#f4f4f4', stick_dome: '#d6171f', stick_cap: '#8a8b8e',
           dpad: '#8f9093', menu_btn: '#f2f2f2', icon: '#777', bumper: '#e8e8e8', trigger: '#e8e8e8', label: '#999',
           paddle: '#c9c9cb', switch: '#8a8b8e',
           letter_A: '#e01e25', letter_B: '#e01e25', letter_X: '#e01e25', letter_Y: '#e01e25', glow: 0 },
};
// Расцветки с драконом — по живым фото G6/photo_*.jpg; рисунок — отдельной картой цвета корпуса
// (tools/04_dragon_decal.py), грузится только для этих расцветок.
// Буквы ABXY на фото оливковые: #6a7049 на снимках белой версии, #a8b384 — чёрной (разная
// экспозиция кадров, краска одна) — берём середину.
const DRAGON_LETTERS = { letter_A: '#8f9a6a', letter_B: '#8f9a6a', letter_X: '#8f9a6a', letter_Y: '#8f9a6a', glow: 0 };
VARIANTS.dragon = { ...VARIANTS.white, btn: '#111112', stick_dome: '#141415', stick_cap: '#18181a', dpad: '#1e1e20',
                    menu_btn: '#151516', icon: '#9a9a9a', bumper: '#1c1c1e', trigger: '#1c1c1e',
                    paddle: '#18181a', switch: '#18181a', ...DRAGON_LETTERS, decal: 'g6_dragon.webp' };
// чёрный корпус: цвет корпуса лежит в самой карте (фон #1c1c1e), поэтому материал корпуса белый;
// шейки стиков на фото жёлтые (красная надпись Home на том фото — это режим V3, а не расцветка)
VARIANTS.dragon_black = { ...VARIANTS.black, body: '#ffffff', stick_dome: '#e8c21c', ...DRAGON_LETTERS,
                          decal: 'g6_dragon_black.webp' };
const decalTex = {};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8e8ea');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// модель в метрах: 0.155 x 0.056 x 0.097
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.005, 5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.08; controls.maxDistance = 0.8;

const sun = new THREE.DirectionalLight('#ffffff', 1.2);
sun.position.set(0.15, 0.4, 0.2);
sun.castShadow = true;
// 4096 на ±0.45 м — 0.22 мм на тексель: с ноутбуком в кадре тень нужна шире, чем у одного геймпада
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -0.45, right: 0.45, top: 0.45, bottom: -0.45, near: 0.05, far: 1.5 });
sun.shadow.bias = -0.0004;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);

const nodes = {};       // имя узла -> { obj, anim, base: {pos, quat} }
const materials = {};   // имя материала -> [MeshStandardMaterial]
let homeView = null;

const t0 = performance.now();
const gltf = await loader.loadAsync('g6.glb');
const loadMs = performance.now() - t0;
const root = gltf.scene;
scene.add(root);
root.traverse(o => {
  if (o.isMesh) {
    o.castShadow = o.receiveShadow = true;
    (materials[o.material.name] ??= []).includes(o.material) || materials[o.material.name].push(o.material);
  }
  if (o.userData.anim) {
    nodes[o.name] = { obj: o, anim: JSON.parse(o.userData.anim), pos: o.position.clone(), quat: o.quaternion.clone() };
  }
});
for (const m of materials.home_cap ?? []) { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; }
for (const m of materials.logo ?? []) m.toneMapped = false;

const box = new THREE.Box3().setFromObject(root);
const center = box.getCenter(new THREE.Vector3());
function resetView() {
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(0.09, 0.17, 0.25));
  controls.update();
}
resetView();
document.getElementById('loading').remove();

// Рисунок дракона — карта цвета корпуса, цветом её не смешать. Поэтому в шейдер корпуса добавлена
// «сила рисунка» uDecalMix 0…1: при 0 карта не влияет, и снимать её с материала не нужно (снятие
// карты — пересборка шейдера, на ней кадр подвисает). Плавная смена: цвета материалов — линейно,
// рисунок — старый гаснет в первой половине перехода, новый проявляется во второй.
const decalMix = { value: 0 };
for (const m of materials.body ?? []) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uDecalMix = decalMix;
    sh.fragmentShader = 'uniform float uDecalMix;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\n  vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n' +
      '  diffuseColor.rgb *= mix( vec3( 1.0 ), sampledDiffuseColor.rgb, uDecalMix );\n#endif');
  };
}
async function loadDecal(file) {
  if (!decalTex[file]) {
    const tx = await new THREE.TextureLoader().loadAsync(file);
    tx.flipY = false;                             // UV из glTF: начало координат сверху
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
    decalTex[file] = tx;
  }
  return decalTex[file];
}
let variantName = 'black', vfade = null;
const setBodyMap = tx => { for (const m of materials.body ?? []) if (m.map !== tx) { m.map = tx; m.needsUpdate = true; } };
async function setVariant(name, ms = 0) {
  const v = VARIANTS[name];
  const tx = v.decal ? await loadDecal(v.decal) : null;
  document.querySelectorAll('#variants .sw').forEach(b => b.classList.toggle('on', b.dataset.v === name));
  variantName = name;
  if (ms > 0) {
    // откуда — текущие цвета (переход мог начаться посреди предыдущего)
    const from = {};
    for (const [mat, list] of Object.entries(materials)) if (v[mat]) from[mat] = [list[0].color.clone(), list[0].emissive?.clone(), list[0].userData.glow ?? 0];
    vfade = { v, from, t0: performance.now(), ms, mapFrom: decalMix.value > 0 ? materials.body?.[0].map : null, mixFrom: decalMix.value, mapTo: tx };
    return;
  }
  vfade = null;
  if (tx) setBodyMap(tx);
  decalMix.value = tx ? 1 : 0;
  for (const [mat, list] of Object.entries(materials)) {
    if (!v[mat]) continue;
    for (const m of list) {
      m.color.set(v[mat]);
      if (mat.startsWith('letter_')) { m.emissive.set(v[mat]); m.emissiveIntensity = m.userData.glow = v.glow; }
    }
  }
}
const vc = new THREE.Color();
function updateVariantFade(now) {
  if (!vfade) return;
  const { v, from, t0, ms, mapFrom, mixFrom, mapTo } = vfade;
  const u = Math.min(1, (now - t0) / ms), e = u * u * (3 - 2 * u);
  for (const [mat, [c0, em0, g0]] of Object.entries(from)) {
    vc.set(v[mat]);
    for (const m of materials[mat]) {
      m.color.lerpColors(c0, vc, e);
      if (mat.startsWith('letter_')) { m.emissive.lerpColors(em0, vc, e); m.userData.glow = g0 + (v.glow - g0) * e; }
    }
  }
  if (mapFrom === mapTo) decalMix.value = mapTo ? mixFrom + (1 - mixFrom) * e : mixFrom * (1 - e);
  else if (e < 0.5) { if (mapFrom) setBodyMap(mapFrom); decalMix.value = mapFrom ? mixFrom * (1 - 2 * e) : 0; }
  else { if (mapTo) setBodyMap(mapTo); decalMix.value = mapTo ? 2 * e - 1 : 0; }
  if (u === 1) vfade = null;
}
document.getElementById('variants').addEventListener('click', e => { if (e.target.dataset.v) setVariant(e.target.dataset.v); });
setVariant('black');

// ---------------- состояние входа ----------------
const BTN = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'View', 'Menu', 'Share', 'Home', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'M1', 'M2'];
const zero = () => ({ ...Object.fromEntries(BTN.map(b => [b, 0])), lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 });
const mouse = zero(), keys = zero(), api = zero(), cur = zero();

// Переключатель режимов — дискретный, поэтому не в общем «максимуме входов», а отдельным индексом.
const MODE = nodes.Mode?.anim ?? { names: [], positions: [], default: 0 };
let modeIdx = MODE.default, modePos = MODE.positions[modeIdx] ?? 0;
function setMode(m) {
  const i = typeof m === 'number' ? m : MODE.names.indexOf(m);
  if (i < 0 || i >= MODE.names.length) return;
  const changed = i !== modeIdx;
  modeIdx = i;
  document.querySelectorAll('#modes button').forEach((b, k) => b.classList.toggle('on', k === i));
  if (changed) onModeChange?.();
}
let onModeChange = null;                       // индикатор Home подписывается ниже

// Внешнее управление: G6.set({ A: 1, lx: 0.5, rt: 0.8 }) — значения держатся, пока их не сбросят; G6.reset()
window.G6 = {
  set: s => Object.assign(api, s),
  reset: () => Object.assign(api, zero()),
  variant: name => setVariant(name),
  mode: m => (m === undefined ? MODE.names[modeIdx] : setMode(m)),
  modes: MODE.names,
  inputs: [...BTN, 'lx', 'ly', 'rx', 'ry', 'lt', 'rt'],
  three: { scene, camera, controls, renderer, nodes },
  // поза «Сбросить вид» — для плавного возврата камеры после инструкций
  homeView: () => ({ target: center.clone(), pos: center.clone().add(new THREE.Vector3(0.09, 0.17, 0.25)) }),
};
document.getElementById('modes').innerHTML = MODE.names.map(n => `<button>${n}</button>`).join('');
document.getElementById('modes').addEventListener('click', e => {
  const i = [...e.currentTarget.children].indexOf(e.target); if (i >= 0) setMode(i);
});
setMode(modeIdx);
let demo = false, demoT = 0;

// стандартная раскладка Gamepad API (w3c.github.io/gamepad/#remapping); 17 — Share у Xbox Series в Chrome
const PAD_BTN = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3',
                  12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right', 16: 'Home', 17: 'Share' };
function readPad() {
  const s = zero();
  const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p && p.connected);
  document.getElementById('pad').textContent = pad ? t('Геймпад: ') + pad.id.slice(0, 48) : t('Геймпад не подключён — нажмите любую кнопку на нём');
  if (!pad) return s;
  for (const [i, n] of Object.entries(PAD_BTN)) if (pad.buttons[i]) s[n] = pad.buttons[i].value;
  s.lt = pad.buttons[6]?.value ?? 0; s.rt = pad.buttons[7]?.value ?? 0;
  const dz = v => Math.abs(v) < 0.08 ? 0 : v;
  [s.lx, s.ly, s.rx, s.ry] = [0, 1, 2, 3].map(i => dz(pad.axes[i] ?? 0));
  return s;
}

// Демо — рекламный показ: цикл 16 с; кнопки по очереди, стики описывают круги и «восьмёрки»,
// триггеры и бамперы, крестовина, лопатки. HOME и T в демо не нажимаются: HOME меняет состояние
// индикатора (связь, выключение), а T — модификатор турбо и вибрации.
function demoState(time) {
  const s = zero(), p = time % 16;
  const pulse = (a, b) => (p > a && p < b) ? Math.sin(Math.PI * (p - a) / (b - a)) : 0;
  const env = (a, b) => (p > a && p < b) ? Math.min(1, (p - a) / 0.4, (b - p) / 0.4) : 0;   // плавный вход и выход
  s.A = pulse(0.0, 0.4); s.B = pulse(0.4, 0.8); s.X = pulse(0.8, 1.2); s.Y = pulse(1.2, 1.6);
  let e = env(1.8, 5.0);
  if (e) { const a = (p - 1.8) * Math.PI * 2 / 1.6; s.lx = e * Math.cos(a); s.ly = e * Math.sin(a); s.rx = -e * Math.cos(a); s.ry = e * Math.sin(a); }
  s.lt = pulse(5.0, 6.0); s.rt = pulse(5.6, 6.6);
  s.LB = pulse(6.8, 7.2); s.RB = pulse(7.2, 7.6);
  s.Up = pulse(7.8, 8.2); s.Right = pulse(8.2, 8.6); s.Down = pulse(8.6, 9.0); s.Left = pulse(9.0, 9.4);
  s.M1 = pulse(10.2, 10.6); s.M2 = pulse(10.7, 11.1);   // во второй половине плана лопаток — камера уже на месте
  e = env(11.2, 14.4);
  if (e) { const a = (p - 10.8) * Math.PI * 2 / 1.8; s.lx = 0.85 * e * Math.sin(a); s.ly = 0.6 * e * Math.sin(2 * a);
    s.rx = -0.85 * e * Math.sin(a); s.ry = 0.6 * e * Math.sin(2 * a); }
  s.View = pulse(14.5, 14.8); s.Menu = pulse(14.8, 15.1); s.L3 = pulse(15.2, 15.5); s.R3 = pulse(15.5, 15.8);
  return s;
}

// ---------------- клавиатура ----------------
const KEYMAP = { Digit1: 'A', Digit2: 'B', Digit3: 'X', Digit4: 'Y', KeyQ: 'LB', KeyE: 'RB', KeyT: 'Up', KeyG: 'Down',
                 KeyF: 'Left', KeyH: 'Right', KeyZ: 'lt', KeyC: 'rt', KeyV: 'M1', KeyB: 'M2', Space: 'Home', KeyN: 'Share' };   // N — кнопка T
const held = new Set();
function applyKeys() {
  for (const k of Object.keys(keys)) keys[k] = 0;
  for (const [code, n] of Object.entries(KEYMAP)) if (held.has(code)) keys[n] = 1;
  keys.lx = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  keys.ly = (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0);
  keys.rx = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
  keys.ry = (held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0);
}
addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyM' && !e.repeat) setMode((modeIdx + 1) % MODE.names.length);
  if (e.code === 'KeyU' && !e.repeat) cableBtn.pc.disabled ? warn(CONFLICT + ': сначала выньте ресивер') : cableBtn.pc.click();
  if (e.code === 'KeyJ' && !e.repeat) cableBtn.charger.click();
  if (e.code === 'KeyR' && !e.repeat) rxBtn.disabled ? warn(CONFLICT + ': сначала выньте кабель из ПК') : rxBtn.click();
  held.add(e.code); applyKeys();
});
addEventListener('keyup', e => { held.delete(e.code); applyKeys(); });
addEventListener('blur', () => { held.clear(); applyKeys(); });

// ---------------- мышь по модели ----------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const NODE_INPUT = { Btn_A: 'A', Btn_B: 'B', Btn_X: 'X', Btn_Y: 'Y', Btn_View: 'View', Btn_Menu: 'Menu', Btn_Share: 'Share',
                     Btn_Home: 'Home', LB: 'LB', RB: 'RB', LT: 'lt', RT: 'rt', M1: 'M1', M2: 'M2' };
let drag = null;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const hit of ray.intersectObject(root, true)) {
    for (let o = hit.object; o; o = o.parent) if (nodes[o.name]) return { name: o.name, point: hit.point };
  }
  return null;
}
renderer.domElement.addEventListener('pointerdown', e => {
  const p = pick(e);
  if (!p) return;
  controls.enabled = false;
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
  drag = { name: p.name, x: e.clientX, y: e.clientY, moved: false };
  if (NODE_INPUT[p.name]) mouse[NODE_INPUT[p.name]] = 1;
  if (p.name === 'DPad') {
    // направление — по точке попадания относительно центра крестовины, в осях модели
    const local = nodes.DPad.obj.worldToLocal(p.point.clone());
    const dir = Math.abs(local.x) > Math.abs(local.z) ? (local.x > 0 ? 'Right' : 'Left') : (local.z > 0 ? 'Down' : 'Up');
    mouse[dir] = 1; drag.dir = dir;
  }
  if (p.name === 'Mode') {
    // шаг в сторону той половины ручки, по которой кликнули (ось узла — +X модели)
    const local = nodes.Mode.obj.worldToLocal(p.point.clone());
    const axis = new THREE.Vector3().fromArray(MODE.axis);
    const step = local.dot(axis) > 0 ? -1 : 1;      // positions убывают вдоль оси: V3 = +4.29 мм
    setMode(Math.max(0, Math.min(MODE.names.length - 1, modeIdx + step)));
  }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!drag || !drag.name.startsWith('Stick')) return;
  const dx = (e.clientX - drag.x) / 50, dy = (e.clientY - drag.y) / 50;
  if (Math.hypot(dx, dy) > 0.08) drag.moved = true;
  const k = Math.min(1, 1 / Math.max(1e-6, Math.hypot(dx, dy)));
  const [ax, ay] = drag.name === 'Stick_L' ? ['lx', 'ly'] : ['rx', 'ry'];
  mouse[ax] = dx * Math.min(1, k); mouse[ay] = dy * Math.min(1, k);
});
function release() {
  if (!drag) return;
  if (drag.name.startsWith('Stick') && !drag.moved) {
    const b = drag.name === 'Stick_L' ? 'L3' : 'R3';
    mouse[b] = 1; setTimeout(() => (mouse[b] = 0), 160);
  }
  for (const k of Object.keys(mouse)) if (!(k === 'L3' || k === 'R3')) mouse[k] = 0;
  drag = null; controls.enabled = true;
}
renderer.domElement.addEventListener('pointerup', release);
renderer.domElement.addEventListener('pointercancel', release);

const demoBtn = document.getElementById('demo');
demoBtn.addEventListener('click', () => setDemo(!demo));
document.getElementById('reset').addEventListener('click', resetView);

// ---------------- применение к узлам ----------------
const q = new THREE.Quaternion(), v3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;
function press(name, value) {
  const n = nodes[name]; if (!n) return;
  v3.fromArray(n.anim.axis).multiplyScalar(n.anim.travel * 0.001 * value);
  n.obj.position.copy(n.pos).add(v3);
}
function rotate(name, axis, deg) {
  const n = nodes[name]; if (!n) return;
  q.setFromAxisAngle(axis, deg * DEG);
  n.obj.quaternion.copy(n.quat).multiply(q);
}
function tilt(name, x, y, deg) {
  // наклон верха к (x, y): y > 0 — к игроку (+Z в glTF), ось вращения = UP × dir
  const n = nodes[name]; if (!n) return;
  const len = Math.min(1, Math.hypot(x, y));
  if (len < 1e-4) { n.obj.quaternion.copy(n.quat); return; }
  const a = Math.atan2(y, x);
  v3.set(Math.sin(a), 0, -Math.cos(a));            // UP × (cos a, 0, sin a)
  q.setFromAxisAngle(v3, len * deg * DEG);
  n.obj.quaternion.copy(n.quat).multiply(q);
}
function apply(s) {
  for (const b of ['A', 'B', 'X', 'Y', 'View', 'Menu', 'Share', 'Home']) press('Btn_' + b, s[b]);
  press('M1', s.M1); press('M2', s.M2);
  const m = nodes.Mode;
  if (m) m.obj.position.copy(m.pos).addScaledVector(v3.fromArray(m.anim.axis), modePos * 0.001);
  for (const [node, ax, ay, btn] of [['Stick_L', 'lx', 'ly', 'L3'], ['Stick_R', 'rx', 'ry', 'R3']]) {
    const n = nodes[node]; if (!n) continue;
    tilt(node, s[ax], s[ay], n.anim.maxdeg);
    n.obj.position.copy(n.pos).addScaledVector(UP, -n.anim.travel * 0.001 * s[btn]);
  }
  tilt('DPad', s.Right - s.Left, s.Down - s.Up, nodes.DPad?.anim.maxdeg ?? 5);
  for (const [node, val] of [['LT', s.lt], ['RT', s.rt], ['LB', s.LB], ['RB', s.RB]]) {
    const n = nodes[node]; if (!n) continue;
    rotate(node, v3.fromArray(n.anim.axis).clone(), n.anim.maxdeg * val);
  }
}

// ---------------- индикатор Home ----------------
// Светится сама надпись BSP, линза кнопки рассеивает свет; цвет — по положению переключателя.
// По умолчанию не горит. Коротко Home — мигает 1 раз/с (подключение к уже спаренному устройству),
// удержание 3 с — 2 раза/с (сопряжение; включается на третьей секунде, не дожидаясь отпускания).
// Переключили режим, пока индикатор активен, — гаснет. Кабель в Type-C (зарядка или компьютер) —
// мигает 1 раз в 3 с цветом текущего режима.
const LED_COLOR = { V3: '#ff2a1a', M: '#a23cff', X: '#2fb8ff', S: '#2bdc5a', '2.4G': '#2fb8ff' };
const LED_NAME = { V3: 'красный', M: 'фиолетовый', X: 'голубой', S: 'зелёный', '2.4G': 'голубой' };
// macro — запись макроса: «быстро мигает» белым; частота не указана — взята как у сопряжения
const LED_HZ = { connect: 1, pair: 2, charge: 1 / 3, macro: 2 };
const LONG_PRESS_MS = 3000;
// Пока беспроводное подключение активно, надпись горит постоянно — и при вставленном кабеле тоже.
// Повторное подключение к уже сопряжённому устройству — «через пару секунд горит постоянно» (так на
// изделии) — 2 с. Допущения (в описании их нет): сопряжение без участия ПК «удаётся» через 8 с
// (в инструкции его завершает Windows); мигание — половину периода горит, половину нет (у зарядки
// 1.5 с / 1.5 с); при вставленном кабеле после переключения режима продолжается зарядное мигание.
const CONNECT_MS = 2000, PAIR_MS = 8000;
// Связь есть: коротко HOME — кнопка «Домой», индикатор не меняется; удержание 5 с — выключение
// (так на изделии). Быстрое мигание на 3-й секунде в этом случае не включается.
const POWER_OFF_MS = 5000;
// В режиме 2.4G сопряжение с ресивером «почти моментальное» (так по описанию) — берём 0.6 с от
// нажатия Home или от момента, когда ресивер вошёл в порт. Без ресивера в компьютере Home мигает,
// пока ресивер не вставят (допущение: тайм-аута и ухода в сон нет).
const CONNECT_24G_MS = 600;
let rxIn = false, rxInAt = 0;                  // ресивер вставлен в USB ноутбука (блок ресивера ниже)
function linked(kind, now) {
  // пока HOME держат, связь не устанавливается: иначе при 2 с на подключение удержание до 3 с
  // (вход в сопряжение) не успевало бы сработать
  if (homeDownAt !== null) return false;
  if (MODE.names[modeIdx] === '2.4G') return rxIn && now - Math.max(led.since, rxInAt) > CONNECT_24G_MS;
  return now - led.since > (kind === 'pair' ? PAIR_MS : CONNECT_MS);
}
const led = { state: 'off', since: 0 };
let homeDownAt = null, homeLong = false, homeWasOn = false, cableIn = false;
const ledLight = new THREE.PointLight('#ffffff', 0, 0.03, 2);
// надпись (O00–O05) — на 3.4 мм выше точки шарнира кнопки, под куполом линзы
nodes.Btn_Home?.obj.add(ledLight); ledLight.position.set(0, 0.0034, 0);
function setLed(state) { led.state = state; led.since = performance.now(); }
const idle = () => setLed(cableIn ? 'charge' : 'off');
// 'home' — нажата кнопка «Домой» при связи, 'poweroff' — выключение; слушает инструкция и панель
const homeListeners = [];
function homeEvent(kind) { homeListeners.forEach(f => f(kind)); if (kind === 'home') warn('HOME при активной связи — кнопка «Домой»', true); if (kind === 'poweroff') warn('HOME 5 с — геймпад выключен', true); }
onModeChange = () => { if (led.state !== 'off') idle(); };
function ledLevel(now) {
  const t = now - led.since;
  if ((led.state === 'connect' || led.state === 'pair') && linked(led.state, now)) setLed('on');
  if (led.state === 'off') return 0;
  if (led.state === 'on') return 1;
  return (t / 1000 * LED_HZ[led.state]) % 1 < 0.5 ? 1 : 0;
}
function updateLed(now, homeRaw) {
  // Медленное мигание начинается сразу при нажатии, а не после отпускания (так на изделии); при
  // удержании до 3 с переходит в быстрое. Если связь уже есть (горит ровно), короткое нажатие — кнопка
  // «Домой», а удержание 5 с выключает геймпад.
  if (homeRaw > 0.5 && homeDownAt === null) {
    homeDownAt = now; homeLong = false; homeWasOn = led.state === 'on';
    if (!homeWasOn) setLed('connect'); else homeEvent('home');
  }
  if (homeDownAt !== null && homeRaw > 0.5 && !homeLong) {
    if (!homeWasOn && now - homeDownAt >= LONG_PRESS_MS) { homeLong = true; setLed('pair'); }
    if (homeWasOn && now - homeDownAt >= POWER_OFF_MS) { homeLong = true; idle(); homeEvent('poweroff'); }
  }
  if (homeDownAt !== null && homeRaw <= 0.5) homeDownAt = null;
  // запись макроса — белым при любом режиме (так на изделии)
  const mode = MODE.names[modeIdx], color = led.state === 'macro' ? '#ffffff' : LED_COLOR[mode] ?? '#ffffff', lv = ledLevel(now);
  for (const m of materials.logo ?? []) {
    m.color.set(lv ? color : '#202022'); m.emissive.set(color); m.emissiveIntensity = 3 * lv;
  }
  // линза: слабое собственное свечение того же цвета + точечный свет изнутри купола.
  // При 0.35 купол заливался цветом целиком и надпись на нём терялась; на фото ярче всего надпись,
  // а линза тёмная, с мягким ореолом
  for (const m of materials.home_cap ?? []) { m.emissive.set(color); m.emissiveIntensity = 0.08 * lv; }
  ledLight.color.set(color); ledLight.intensity = 0.02 * lv;
  ledEl.textContent = `Home: ${t(led.state === 'macro' ? 'белый' : LED_NAME[mode] ?? '')}, ` + t(({ on: 'горит', off: 'не горит',
    connect: 'мигает 1 раз/с — подключение', pair: 'мигает 2 раза/с — сопряжение',
    charge: 'мигает 1 раз в 3 с — кабель', macro: 'быстро мигает белым — запись макроса' })[led.state]);
  updateReceiver(now, mode === '2.4G' && led.state === 'on');
}
const ledEl = document.getElementById('led');
G6.onHome = f => homeListeners.push(f);
G6.led = s => (s === undefined ? led.state : setLed(s));   // 'on' | 'off' | 'connect' | 'pair' | 'charge'

// ---------------- кабель Type-C ----------------
// Порт (S16) по геометрии: устье розетки y = 19.45 мм, проём 8.94 × 3.16 мм (стандарт USB-C), центр
// x = 0, z = 34.0 мм; наружная поверхность корпуса вокруг — плоскость y = 19.89 мм (нормаль +Y).
// Штекер Type-C — по размерам стандарта: металл 8.25 × 2.4 × 6.65 мм уходит в розетку до y = 13.24 мм
// (глубина розетки 7.57 мм), литой корпус 12 × 6.5 × 16 мм упирается в наружную плоскость.
// В координатах glTF: (x, z, −y) мм -> м; наружу из порта — −Z.
const MM = 0.001;
const PORT = new THREE.Vector3(0, 34.0 * MM, -19.89 * MM);
const UNPLUGGED = 0.035;                         // на сколько штекер отъезжает наружу, м
function stadium(w, h) {
  const r = h / 2, s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -r); s.lineTo(w / 2 - r, -r); s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  s.lineTo(-w / 2 + r, r); s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5); return s;
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
// ноутбук (tools/05_laptop.py): справа сзади от геймпада, левым боком с портами USB-A к нему.
// Порты — на x ≈ 0.100 м, в 22 мм от края геймпада (0.078). USB_Port (ресивер) на z = −0.08 м,
// USB_Port2 (кабель) на z = −0.16 м; всё, что из них торчит, — позади геймпада (его задний край —
// z = −0.023) и его не задевает.
const laptop = (await loader.loadAsync('laptop.glb')).scene;
laptop.position.set(0.26, 0, -0.15);
laptop.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
scene.add(laptop); laptop.updateMatrixWorld(true);
const USB2 = laptop.getObjectByName('USB_Port2').getWorldPosition(new THREE.Vector3());

// Кабель Type-C -> USB-A: один конец в геймпад, другой — в ноутбук (ПК) или в USB-блок питания.
// Питание (а с ним зарядное мигание Home 1 раз в 3 с) — только когда вставлены оба конца. Вставка:
// сначала USB-A, затем Type-C в геймпад, по 0.5 с; отключение — в обратном порядке. Переключение
// ПК <-> зарядка — через полное отключение.
// Кабель в ПК одновременно с ресивером в ПК запрещён: на изделии это конфликт двух подключений.
// Кабель в зарядку + ресивер в ПК — можно.
const CABLE_ANIM_S = 1.0;
const plug = new THREE.Group(), plugA = new THREE.Group();     // Type-C у геймпада, USB-A — на другом конце
const rubber = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.7 });
const metal = new THREE.MeshStandardMaterial({ color: '#d4d7db', metalness: 1, roughness: 0.18 });
const ext = (shape, depth, bevel) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !!bevel,
  bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16 });
{
  // у обоих штекеров локальная +Z — внутрь корпуса, z = 0 — наружная плоскость корпуса у порта
  const add = (g, ...ms) => ms.forEach(m => { m.castShadow = m.receiveShadow = true; g.add(m); });
  {
    const shell = new THREE.Mesh(ext(stadium(8.25 * MM, 2.4 * MM), 6.65 * MM), metal);
    const body = new THREE.Mesh(ext(roundRect(12 * MM, 6.5 * MM, 2.2 * MM), 15 * MM, 0.5 * MM), rubber);
    body.position.z = -15.5 * MM;
    const relief = new THREE.Mesh(new THREE.CylinderGeometry(2.3 * MM, 1.9 * MM, 10 * MM, 24), rubber);
    relief.rotation.x = Math.PI / 2; relief.position.z = -21 * MM;
    add(plug, shell, body, relief);
  }
  {
    // USB-A по стандарту: металл 12 × 4.5 мм, вылет 12 мм; литой корпус 16 × 7.5 × 17 мм — типовой
    const shell = new THREE.Mesh(new THREE.BoxGeometry(12 * MM, 4.5 * MM, 12 * MM), metal); shell.position.z = 6 * MM;
    const body = new THREE.Mesh(ext(roundRect(16 * MM, 7.5 * MM, 1.5 * MM), 16 * MM, 0.5 * MM), rubber);
    body.position.z = -16.5 * MM;
    const relief = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * MM, 1.9 * MM, 10 * MM, 24), rubber);
    relief.rotation.x = Math.PI / 2; relief.position.z = -22 * MM;
    add(plugA, shell, body, relief);
  }
}

// USB-блок питания (5 В) — типовой, не по конкретному изделию: 45 × 28 × 55 мм, лежит на столе позади
// геймпада слева, порт USB-A на передней грани (к геймпаду), сетевой шнур уходит назад со стола.
const CHG = { w: 45 * MM, h: 28 * MM, d: 55 * MM, pos: new THREE.Vector3(-0.11, 0, -0.17) };
const charger = new THREE.Group();
{
  const white = new THREE.MeshStandardMaterial({ color: '#ececec', roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9 });
  const blue = new THREE.MeshStandardMaterial({ color: '#1a4fd0', roughness: 0.5 });
  const g = ext(roundRect(CHG.w - 6 * MM, CHG.h - 6 * MM, 4 * MM), CHG.d - 6 * MM, 3 * MM);
  const box = new THREE.Mesh(g, white); box.position.set(0, CHG.h / 2, -(CHG.d - 6 * MM) / 2); charger.add(box);
  // розетка USB-A 12.5 × 5.12 мм на передней грани: проём, металлическая рамка, синий язычок сверху
  const face = CHG.d / 2, py = CHG.h / 2;
  const plate = (w, h, d, x, y, z, m) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); p.position.set(x, y, z); charger.add(p); };
  plate(12.5 * MM, 5.12 * MM, 0.2 * MM, 0, py, face + 0.05 * MM, dark);
  for (const s of [1, -1]) {
    plate(13.4 * MM, 0.45 * MM, 0.3 * MM, 0, py + s * 2.79 * MM, face + 0.12 * MM, metal);
    plate(0.45 * MM, 5.12 * MM, 0.3 * MM, s * 6.48 * MM, py, face + 0.12 * MM, metal);
  }
  plate(11 * MM, 1.7 * MM, 0.3 * MM, 0, py + 1.05 * MM, face + 0.1 * MM, blue);
  // сетевой шнур: назад от задней грани и вниз за край стола
  const back = -CHG.d / 2;
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0, py, back), new THREE.Vector3(0, py, back - 20 * MM),
    new THREE.Vector3(0.01, 2.5 * MM, back - 60 * MM), new THREE.Vector3(0.03, 2.5 * MM, back - 200 * MM)]);
  charger.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 48, 2.2 * MM, 10), white));
  charger.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
}
charger.position.copy(CHG.pos); scene.add(charger);
const CHG_PORT = CHG.pos.clone().add(new THREE.Vector3(0, CHG.h / 2, CHG.d / 2));

// куда входит USB-A: точка устья и направление внутрь устройства
const DEST = { pc: { p: USB2, d: new THREE.Vector3(1, 0, 0) }, charger: { p: CHG_PORT, d: new THREE.Vector3(0, 0, -1) } };
scene.add(plug, plugA);
const cableMesh = new THREE.Mesh(new THREE.BufferGeometry(), rubber);
cableMesh.castShadow = cableMesh.receiveShadow = true; scene.add(cableMesh);
const TAIL_C = 26 * MM, TAIL_A = 27 * MM;          // от плоскости корпуса до конца хвостовика
let cableA = 0, cableTarget = 0, cableDest = 'pc', cablePending = null;
const ease = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const Z_AXIS = new THREE.Vector3(0, 0, 1);
function placeCable() {
  const outA = UNPLUGGED * (1 - ease(cableA / 0.5)), outC = UNPLUGGED * (1 - ease((cableA - 0.5) / 0.5));
  const { p, d } = DEST[cableDest];
  plug.position.set(PORT.x, PORT.y, PORT.z - outC);
  plugA.position.copy(p).addScaledVector(d, -outA); plugA.quaternion.setFromUnitVectors(Z_AXIS, d);
  // провод: назад из хвостовика Type-C, провис к столу посередине, к хвостовику USB-A по его оси
  const a = new THREE.Vector3(PORT.x, PORT.y, PORT.z - outC - TAIL_C);
  const b = p.clone().addScaledVector(d, -(outA + TAIL_A));
  const mid = a.clone().lerp(b, 0.5); mid.y = 2.5 * MM;   // радиус провода 1.75 мм + запас
  const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0, -2 * MM, -18 * MM)), mid,
    b.clone().addScaledVector(d, -18 * MM).add(new THREE.Vector3(0, -2 * MM, 0)), b]);
  cableMesh.geometry.dispose();
  cableMesh.geometry = new THREE.TubeGeometry(curve, 64, 1.75 * MM, 10);
  const shown = cableA > 0 || cableTarget > 0 || cablePending;
  plug.visible = plugA.visible = cableMesh.visible = !!shown;
}
placeCable();
const warnEl = document.getElementById('warn');
let warnUntil = 0;
function warn(text, info = false) {             // info — не ошибка, а сообщение о событии (серым)
  warnEl.textContent = t(text); warnEl.style.color = info ? '#6b6b70' : '#d93a2b'; warnUntil = performance.now() + 4000;
}
const CONFLICT = 'Кабель в ПК и ресивер в ПК одновременно нельзя — конфликт подключений';
// где кабель (или куда едет): null — отключён
const cableGoal = () => cablePending ?? (cableTarget ? cableDest : null);
function setCable(dest) {                         // 'pc' | 'charger' | null
  if (dest === 'pc' && rxTarget === 1) { warn(CONFLICT + ': сначала выньте ресивер'); return false; }
  if (cableIn && dest !== cableDest) { cableIn = false; if (led.state === 'charge') setLed('off'); }
  if (dest && dest !== cableDest && cableA > 0) { cablePending = dest; cableTarget = 0; }   // сначала вынуть
  else { cablePending = null; if (dest) cableDest = dest; cableTarget = dest ? 1 : 0; }
  placeCable(); return true;
}
function updatePlug(dt) {
  if (cableA === cableTarget) return;
  cableA = cableTarget > cableA ? Math.min(1, cableA + dt / CABLE_ANIM_S) : Math.max(0, cableA - dt / CABLE_ANIM_S);
  if (cableA === 0 && cablePending) { cableDest = cablePending; cablePending = null; cableTarget = 1; }
  placeCable();
  if (cableA === 1 && !cableIn) { cableIn = true; if (led.state === 'off') setLed('charge'); }
}
const cableBtn = { pc: document.getElementById('cable'), charger: document.getElementById('cablechg') };
for (const [dest, btn] of Object.entries(cableBtn))
  btn.addEventListener('click', () => setCable(cableGoal() === dest ? null : dest));
G6.cable = dest => {
  if (dest === undefined) return cableIn ? cableDest : null;
  return setCable(dest === true ? 'pc' : dest || null);
};

// ---------------- ресивер 2.4G ----------------
// По живым фото G6/photo_2026-11-02_15-52-*.jpg и эскизу (общая длина 45 мм):
//  - штекер USB-A по стандарту: металл 12 × 4.5 мм, вылет 12 мм, внутри зелёная плата с контактами,
//    сверху два квадратных и два мелких окна -> корпус 45 − 12 = 33 мм;
//  - корпус из двух половин со швом посередине толщины, фаски по длинным рёбрам; толщина 8.4 мм —
//    по фото сбоку она в 1.87 раза больше толщины штекера (4.5 мм);
//  - в плане корпус сужен у штекера и расширяется к концу, на конце скосы. Ширины 13.3 / 16.9 / 10.4 мм
//    (у штекера / начало скосов / торец) — оценка по фото, снятому под углом, не замер;
//  - индикатор — точка Ø ~0.9 мм на лицевой стороне, ~7 мм от штекера.
// Своего питания у ресивера нет: индикатор работает, только пока он вставлен в USB ноутбука.
// Вставлен и ждёт сопряжения — мигает красным 1 раз/с; после сопряжения (режим 2.4G и Home
// подключён) — горит красным постоянно. Вынули ресивер при активной связи — Home снова мигает
// 1 раз/с, ищет ресивер, и подключается сам, как только ресивер вернут (так и на изделии).
const RX = { plugL: 12, plugW: 12, plugH: 4.5, bodyL: 33, wNear: 13.3, wWide: 16.9, wEnd: 10.4, chamferL: 4.5,
             t: 8.4, seam: 0.2, bevel: 0.6, ledZ: 7, ledR: 0.45 };
const receiver = new THREE.Group();
let rxLedMat, rxLight;
{
  const mm = v => v * MM;
  const plastic = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.62 });
  // при 0.3 металл штекера выходил матово-серым, на фото он блестит
  const metal = new THREE.MeshStandardMaterial({ color: '#d9dce0', metalness: 1, roughness: 0.16 });
  const dark = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.9 });
  const pcb = new THREE.MeshStandardMaterial({ color: '#2f6b3a', roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8b04a', metalness: 1, roughness: 0.25 });
  // план корпуса (x — ширина, y — длина от штекера), сжатый на величину фаски: её добавит bevel
  const b = RX.bevel, half = w => mm(w / 2 - b);
  const yW = RX.bodyL - RX.chamferL;
  const plan = new THREE.Shape();
  plan.moveTo(-half(RX.wNear), mm(b)); plan.lineTo(half(RX.wNear), mm(b));
  plan.lineTo(half(RX.wWide), mm(yW)); plan.lineTo(half(RX.wEnd), mm(RX.bodyL - b));
  plan.lineTo(-half(RX.wEnd), mm(RX.bodyL - b)); plan.lineTo(-half(RX.wWide), mm(yW)); plan.closePath();
  const hT = (RX.t - RX.seam) / 2;
  const shellGeo = new THREE.ExtrudeGeometry(plan, { depth: mm(hT - 2 * b), bevelEnabled: true,
    bevelThickness: mm(b), bevelSize: mm(b), bevelSegments: 1 });
  shellGeo.rotateX(-Math.PI / 2);                    // длина -> −Z, толщина -> +Y
  for (const y0 of [0, hT + RX.seam]) {
    const m = new THREE.Mesh(shellGeo, plastic); m.position.y = mm(y0 + b); receiver.add(m);
  }
  // шов: тёмная вставка, чтобы через щель не просвечивал фон
  const core = new THREE.Mesh(new THREE.ExtrudeGeometry(plan, { depth: mm(RX.seam + 0.4), bevelEnabled: false }), dark);
  core.geometry.rotateX(-Math.PI / 2); core.scale.set(0.97, 1, 0.99); core.position.y = mm(hT - 0.2); receiver.add(core);
  // штекер USB-A: металлическая обойма с открытым торцом, внутри плата с золотыми контактами
  const yc = mm(RX.t / 2), L = mm(RX.plugL), W = mm(RX.plugW), Hh = mm(RX.plugH), s = mm(0.3);
  const plate = (w, h, d, x, y, z, mat) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    p.position.set(x, y, z); receiver.add(p); return p; };
  plate(W, s, L, 0, yc + Hh / 2 - s / 2, L / 2, metal); plate(W, s, L, 0, yc - Hh / 2 + s / 2, L / 2, metal);
  plate(s, Hh, L, W / 2 - s / 2, yc, L / 2, metal); plate(s, Hh, L, -W / 2 + s / 2, yc, L / 2, metal);
  plate(mm(10.6), mm(0.8), mm(10), 0, yc - mm(0.6), mm(6.5), pcb);
  for (const x of [-3.5, -1.2, 1.2, 3.5]) plate(mm(1.5), mm(0.05), mm(4), mm(x), yc - mm(0.17), mm(9.5), gold);
  for (const sx of [-1, 1]) {
    plate(mm(2.2), mm(0.05), mm(2.2), mm(2.5 * sx), yc + Hh / 2 + mm(0.01), mm(8.6), dark);    // окна-защёлки
    plate(mm(1.2), mm(0.05), mm(0.8), mm(2.5 * sx), yc + Hh / 2 + mm(0.01), mm(2.0), dark);
  }
  // индикатор: точка на лицевой стороне + слабый свет, рассеянный в отверстии
  rxLedMat = new THREE.MeshStandardMaterial({ color: '#200404', emissive: '#ff1a10', emissiveIntensity: 0, toneMapped: false });
  const ledDot = new THREE.Mesh(new THREE.CircleGeometry(mm(RX.ledR), 24), rxLedMat);
  ledDot.rotation.x = -Math.PI / 2; ledDot.position.set(0, mm(RX.t) + mm(0.02), -mm(RX.ledZ)); receiver.add(ledDot);
  rxLight = new THREE.PointLight('#ff1a10', 0, 0.012, 2); rxLight.position.set(0, mm(RX.t + 0.6), -mm(RX.ledZ));
  receiver.add(rxLight);
  receiver.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
}
scene.add(receiver);

const USB = laptop.getObjectByName('USB_Port').getWorldPosition(new THREE.Vector3());
// позы ресивера: на столе перед ноутбуком; соосно порту в 35 мм от него; вставлен до упора
// (штекер +Z ресивера -> +X мира, т.е. внутрь ноутбука; лицо с индикатором остаётся сверху)
const yAxis = RX.t / 2 * MM;                    // ось штекера над основанием ресивера
const P_TABLE = new THREE.Vector3(0.13, 0, 0.03), Q_TABLE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.45, 0));
const P_IN = new THREE.Vector3(USB.x, USB.y - yAxis, USB.z), Q_IN = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
const P_PRE = P_IN.clone().add(new THREE.Vector3(-0.035, 0, 0));
const SPLIT = 0.6, RX_ANIM_S = 1.4;             // доля пути «подлёт», полное время анимации
let rxA = 0, rxTarget = 0;
const smooth = u => u * u * (3 - 2 * u);
function placeReceiver() {
  if (rxA <= SPLIT) {                           // подъём со стола и разворот к порту
    const u = smooth(rxA / SPLIT);
    receiver.position.lerpVectors(P_TABLE, P_PRE, u); receiver.position.y += Math.sin(Math.PI * u) * 0.03;
    receiver.quaternion.slerpQuaternions(Q_TABLE, Q_IN, u);
  } else {                                      // прямолинейно в порт
    receiver.position.lerpVectors(P_PRE, P_IN, smooth((rxA - SPLIT) / (1 - SPLIT)));
    receiver.quaternion.copy(Q_IN);
  }
}
placeReceiver();
const rxBtn = document.getElementById('rxbtn');
function setReceiverIn(on) {
  if (on && cableGoal() === 'pc') { warn(CONFLICT + ': сначала выньте кабель из ПК'); return false; }
  rxTarget = on ? 1 : 0; rxBtn.classList.toggle('on', on);
  if (!on && rxIn) {
    rxIn = false;
    if (MODE.names[modeIdx] === '2.4G' && led.state === 'on') setLed('connect');   // связь потеряна
  }
}
function animateReceiver(dt) {
  if (rxA === rxTarget) return;
  rxA = rxTarget > rxA ? Math.min(rxTarget, rxA + dt / RX_ANIM_S) : Math.max(rxTarget, rxA - dt / RX_ANIM_S);
  placeReceiver();
  if (rxA === 1 && !rxIn) { rxIn = true; rxInAt = performance.now(); }   // питание — только до упора
}
let rxPaired = false;
const rxEl = document.getElementById('rx');
function updateReceiver(now, paired) {
  rxPaired = paired && rxIn;
  const lv = !rxIn ? 0 : rxPaired ? 1 : ((now - rxInAt) / 1000 % 1 < 0.5 ? 1 : 0);  // ожидание: 1 раз/с
  rxLedMat.emissiveIntensity = 3 * lv; rxLedMat.color.set(lv ? '#ff1a10' : '#200404');
  rxLight.intensity = 0.004 * lv;
  // кнопки: подсветка — где кабель/ресивер; запрещённое сочетание недоступно
  const goal = cableGoal();
  cableBtn.pc.classList.toggle('on', goal === 'pc'); cableBtn.charger.classList.toggle('on', goal === 'charger');
  cableBtn.pc.disabled = rxTarget === 1 && goal !== 'pc'; rxBtn.disabled = goal === 'pc' && rxTarget !== 1;
  cableBtn.pc.title = t(cableBtn.pc.disabled ? CONFLICT : 'Кабель геймпада в USB ноутбука / вынуть (клавиша U)');
  rxBtn.title = t(rxBtn.disabled ? CONFLICT : 'Вставить ресивер 2.4G в USB ноутбука / вынуть (клавиша R)');
  if (warnUntil && now > warnUntil) { warnEl.textContent = ''; warnUntil = 0; }
  rxEl.textContent = t('Ресивер 2.4G: ') + t(!rxIn ? (rxTarget ? 'вставляется…' : 'не вставлен — не горит')
    : rxPaired ? 'сопряжён — горит красным' : 'ждёт сопряжения — мигает красным 1 раз/с');
}
rxBtn.addEventListener('click', () => setReceiverIn(rxTarget !== 1));
G6.receiver = on => (on === undefined ? (!rxIn ? 'out' : rxPaired ? 'paired' : 'waiting') : setReceiverIn(!!on));

// ---------------- демо ----------------
// Рекламный показ: в кадре только геймпад (ноутбук, зарядка, кабель и ресивер прячутся), камера ведёт
// серию планов, привязанных к тому, что сейчас нажимается; расцветки плавно сменяются; HOME горит цветом
// режима. После остановки камера, индикатор, расцветка и видимость — как были.
let demoSaved = null;
function setDemo(on) {
  if (on === demo) return;
  demo = on; demoT = 0; shotIdx = -1;
  if (on) {
    // Карты 4096² — заранее и сразу в видеопамять, а одну — на корпус при uDecalMix = 0: первое
    // назначение карты пересобирает шейдер. Замер без этого: смена дракон → чёрный дракон давала кадр
    // 128 мс (первая загрузка второй карты), старт демо — 318 мс. Пусть вся пауза будет на старте,
    // где камера и так перескакивает на облёт, а не посреди перехода.
    demoVarIdx = -1;
    for (const n of DEMO_VARIANTS) if (VARIANTS[n].decal)
      loadDecal(VARIANTS[n].decal).then(tx => { renderer.initTexture(tx); if (!materials.body?.[0].map) setBodyMap(tx); });
    demoSaved = { pos: camera.position.clone(), target: controls.target.clone(), led: led.state, variant: variantName,
      vis: [laptop, charger, receiver, plug, plugA, cableMesh].map(o => [o, o.visible]) };
    for (const [o] of demoSaved.vis) o.visible = false;
    controls.enabled = false; setLed('on');
  } else if (demoSaved) {
    for (const [o, v] of demoSaved.vis) o.visible = v;
    camera.clearViewOffset();
    camera.position.copy(demoSaved.pos); controls.target.copy(demoSaved.target); controls.enabled = true;
    setLed(demoSaved.led); setVariant(demoSaved.variant, 600); demoSaved = null;
  }
  demoBtn.classList.toggle('on', demo); demoBtn.textContent = t(demo ? '■ Стоп' : '▶ Демо');
}
// Планы камеры — по циклу входа (demoState, 16 с): крупно ABXY, проезд над стиками, пока они крутятся,
// триггеры и бамперы сзади, крупно крестовина, лопатки M1/M2 снизу сзади, общий облёт на «восьмёрках»,
// крупно HOME. План задан сферическими координатами вокруг своей точки: азимут θ от +Z (сторона игрока)
// к +X, высота φ над горизонтом, расстояние r, — и внутри плана камера медленно едет (θ0 → θ1). Переход
// между планами — 0.9 с интерполяцией тех же координат (азимут — по кратчайшей дуге): камера обходит
// геймпад, а не проходит сквозь корпус, как было бы при линейной интерполяции точек.
// Общий план: расстояние 0.35…0.41 м — при 0.24 и 0.30 сбоку ближняя рукоять (геймпад 155 мм в ширину)
// заполняла кадр целиком (скриншоты прогонов). Для каждого плана расстояние ещё и не меньше того, при
// котором описанная сфера объекта (rs) занимает 85 % свободной части окна: в окне 800 px с панелью
// 360 px справа свободно 440 px, и рукоять обрезалась. Центр проекции сдвинут на половину ширины панели
// (setViewOffset) — геймпад в середине свободной части окна.
const padR = box.getBoundingSphere(new THREE.Sphere()).radius;
const wpos = (...names) => names.map(n => nodes[n].obj.getWorldPosition(new THREE.Vector3()))
  .reduce((a, b) => a.add(b)).multiplyScalar(1 / names.length);
// [начало, конец (с), точка, θ0, θ1, φ, r, rs] — углы в радианах
const SHOTS = [
  [0.0, 1.8, () => wpos('Btn_A', 'Btn_B', 'Btn_X', 'Btn_Y'), 0.25, 0.55, 0.95, 0.13, 0.03],
  [1.8, 5.0, () => wpos('Stick_L', 'Stick_R').add(new THREE.Vector3(0, 0.008, 0)), -0.55, 0.55, 0.62, 0.17, 0.05],
  [5.0, 7.7, () => wpos('LT', 'RT', 'LB', 'RB'), Math.PI - 0.45, Math.PI + 0.45, 0.42, 0.2, 0.065],
  [7.7, 9.5, () => wpos('DPad'), -0.55, -0.25, 1.0, 0.12, 0.025],
  // лопатки — круто снизу: при φ −0.32 сзади кадр закрывали ближняя рукоять и триггер (скриншот прогона)
  [9.5, 11.2, () => wpos('M1', 'M2'), Math.PI - 0.35, Math.PI + 0.05, -0.7, 0.2, 0.06],
  [11.2, 14.4, () => center.clone(), Math.PI * 0.15, Math.PI * 0.85, 0.36, 0.38, padR],
  [14.4, 16.0, () => wpos('Btn_Home'), -0.15, 0.15, 0.9, 0.13, 0.03],
];
const SHOT_BLEND_S = 0.9;
let shotIdx = -1, shotFrom = null;
const camSph = () => {                       // текущая камера в тех же координатах
  const tg = controls.target.clone(), d = camera.position.clone().sub(tg), r = d.length();
  return { tg, th: Math.atan2(d.x, d.z), ph: Math.asin(d.y / r), r };
};
function demoCamera(time) {
  const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
  const pr = document.getElementById('panel').getBoundingClientRect().right;
  const shift = pr < w * 0.6 ? pr / 2 : 0;          // на узком экране панель почти во всю ширину — не сдвигаем
  const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * w / h, free = (w - 2 * shift) / w;
  const fit = rs => rs / (0.85 * Math.min(tanV, tanH * free));
  const p = time % 16, i = SHOTS.findIndex(sh => p >= sh[0] && p < sh[1]);
  if (i !== shotIdx) { shotIdx = i; shotFrom = { ...camSph(), at: time }; }   // начало плана — от текущей камеры
  const [t0, t1, at, th0, th1, ph, r0, rs] = SHOTS[i];
  const u = (p - t0) / (t1 - t0), ue = u * u * (3 - 2 * u);
  const goal = { tg: at(), th: th0 + (th1 - th0) * ue, ph, r: Math.max(fit(rs), i === 5 ? r0 + 0.03 * Math.sin(time * 0.9) : r0) };
  const b = Math.min(1, (time - shotFrom.at) / SHOT_BLEND_S), k = b * b * (3 - 2 * b);
  let dth = goal.th - shotFrom.th; dth -= Math.round(dth / (2 * Math.PI)) * 2 * Math.PI;   // кратчайшая дуга
  const tg = shotFrom.tg.clone().lerp(goal.tg, k), th = shotFrom.th + dth * k, phi = shotFrom.ph + (goal.ph - shotFrom.ph) * k;
  const r = Math.exp(Math.log(shotFrom.r) + (Math.log(goal.r) - Math.log(shotFrom.r)) * k);
  camera.position.set(tg.x + r * Math.cos(phi) * Math.sin(th), tg.y + r * Math.sin(phi), tg.z + r * Math.cos(phi) * Math.cos(th));
  controls.target.copy(tg);
  camera.setViewOffset(w, h, -shift, 0, w, h);
}
// расцветки в демо: каждые 8 с — следующая, переход 1.6 с; после остановки — та, что была до демо
const DEMO_VARIANTS = ['black', 'gray', 'white', 'dragon', 'dragon_black'], VARIANT_EVERY_S = 8, VARIANT_FADE_MS = 1600;
let demoVarIdx = -1;
function demoVariants(time) {
  const i = Math.floor(time / VARIANT_EVERY_S);
  if (i === demoVarIdx) return;
  demoVarIdx = i;
  if (i === 0) return;                                  // первые 8 с — расцветка, выбранная до демо
  const k = (DEMO_VARIANTS.indexOf(demoSaved.variant) + i) % DEMO_VARIANTS.length;
  setVariant(DEMO_VARIANTS[k], VARIANT_FADE_MS);
}
G6.demo = on => (on === undefined ? demo : setDemo(!!on));
// язык: кнопки RU / EN в шапке панели
const langBtns = document.querySelectorAll('[data-lang]');
const showLang = () => {
  langBtns.forEach(b => b.classList.toggle('on', b.dataset.lang === getLang()));
  demoBtn.textContent = t(demo ? '■ Стоп' : '▶ Демо');
};
langBtns.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
onLang(showLang); showLang();
Object.assign(G6, { t, setLang, lang: getLang, applyStatic });

// ---------------- цикл ----------------
const stats = document.getElementById('stats');
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
const glbBytes = (await fetch('g6.glb', { method: 'HEAD' })).headers.get('content-length');
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const pad = readPad();
  if (demo) { demoT += dt; demoCamera(demoT); demoVariants(demoT); }
  updateVariantFade(now);
  const d = demo ? demoState(demoT) : null;
  const k = 1 - Math.exp(-dt * 30);              // ~33 мс до 63 % — быстро, но без рывка
  let homeRaw = 0;
  for (const key of Object.keys(cur)) {
    const sign = v => Math.abs(v);
    const cands = [mouse[key], keys[key], api[key], pad[key], d ? d[key] : 0];
    const target = cands.reduce((a, b) => sign(b) > sign(a) ? b : a, 0);
    if (key === 'Home') homeRaw = target;           // длительность нажатия — по входу, без сглаживания
    cur[key] += (target - cur[key]) * k;
  }
  updatePlug(dt);
  updateModeMark(dt, now);
  animateReceiver(dt);
  updateLed(now, homeRaw);
  modePos += ((MODE.positions[modeIdx] ?? 0) - modePos) * k;
  apply(cur);
  updateVibration(now);
  updateTurbo(now);
  updatePressed(now);
  updateMacro(now);
  controls.update();
  renderer.render(scene, camera);
  stats.textContent = `FPS ${fps.toFixed(0)}   ${t('треуг.')} ${renderer.info.render.triangles.toLocaleString(getLang())}\n` +
                      `GLB ${(glbBytes / 1048576).toFixed(2)} ${t('МБ')}, ${t('загрузка')} ${loadMs.toFixed(0)} ${t('мс')}`;
});

// Размер берём с самого canvas (CSS 100vw×100vh): при открытии в скрытой вкладке/панели
// innerWidth на старте равен 0, а resize может так и не прийти.
function fit() {
  const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h || (c.width === Math.round(w * renderer.getPixelRatio()) && c.height === Math.round(h * renderer.getPixelRatio()))) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(fit).observe(renderer.domElement);

// ---------------- регулировка вибрации ----------------
// Так на изделии: зажать T (Турбо, центральная кнопка «T», в модели узел Btn_Share) и держать;
// правый стик вверх — сильнее, вниз — слабее или выключить; отпустить T — настройка сохранена.
// Работает только на включённом геймпаде — в сопряжении, подключении или с активной связью (так на
// изделии); выключенный (индикатор не горит или только зарядное мигание) на T + стик не реагирует.
// Ступени (так на изделии): 1…3 и самая нижняя — «выкл.». Допущения: по умолчанию 3; один отклон
// стика — одна ступень, без автоповтора; на каждую ступень — импульс вибрации 0.4 с на новом уровне.
const VIB_MAX = 3, VIB_PULSE_MS = 400;
let vibLevel = 3, vibStick = 0, vibAdjust = false, vibPulseAt = -1e9, vibShownUntil = 0;
const vibEl = document.getElementById('vib');
// моторы — грузы S35/S38 в рукоятях: центры (Blender, мм) (∓57.8, −50.6, 22.8) -> glTF (x, z, −y)
const MOTORS = [new THREE.Vector3(-0.0578, 0.0228, 0.0506), new THREE.Vector3(0.0577, 0.0228, 0.0506)];
const RING_N = 3;
const rings = [];
for (const m of MOTORS) for (let i = 0; i < RING_N; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64),
    new THREE.MeshBasicMaterial({ color: '#ff9a1e', transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      toneMapped: false, side: THREE.DoubleSide }));
  r.rotation.x = -Math.PI / 2; r.renderOrder = 10; r.userData = { m, i }; scene.add(r); rings.push(r);
}
function vibPulse() {
  vibPulseAt = performance.now(); vibShownUntil = vibPulseAt + 2500;
  // настоящий геймпад, если подключён: та же сила, та же длительность
  const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p && p.connected);
  pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: VIB_PULSE_MS, strongMagnitude: vibLevel / VIB_MAX,
    weakMagnitude: vibLevel / VIB_MAX }).catch(() => {});
}
function vibStep(d) {
  const nv = Math.max(0, Math.min(VIB_MAX, vibLevel + d));
  if (nv !== vibLevel) { vibLevel = nv; vibPulse(); } else vibShownUntil = performance.now() + 2500;
}
function updateVibration(now) {
  const powered = led.state === 'on' || led.state === 'connect' || led.state === 'pair';
  const tHeld = cur.Share > 0.5 && powered;
  if (cur.Share > 0.5 && !powered && !vibOffWarned) { vibOffWarned = true; warn('Геймпад выключен — включите его (коротко HOME), затем T + правый стик', true); }
  if (cur.Share <= 0.5) vibOffWarned = false;
  // шкала — только после первого отклона правого стика под T: T — общий модификатор (им же включают
  // турбо), и шкала при каждом нажатии T закрывала осциллограф турбо
  if (tHeld && !vibAdjust) { vibAdjust = true; vibTouched = false; }
  if (!tHeld && vibAdjust) { vibAdjust = false; if (vibTouched) { vibShownUntil = now + 2500; vibSaved = now; } }
  // отклон стика с гистерезисом: шаг на выходе за 0.6, новый — только после возврата под 0.3
  const ry = cur.ry;
  if (vibAdjust && vibStick === 0 && Math.abs(ry) > 0.6) { vibStick = Math.sign(ry); vibTouched = true; vibShownUntil = Infinity; vibStep(ry < 0 ? +1 : -1); }
  if (Math.abs(ry) < 0.3) vibStick = 0;
  // дрожь корпуса и волны от моторов во время импульса
  // доля импульса — не t: t() — перевод строк (i18n.js), локальная t его затеняла и роняла цикл кадра
  const pt = (now - vibPulseAt) / VIB_PULSE_MS, k = pt >= 0 && pt < 1 ? vibLevel / VIB_MAX : 0;
  const amp = 0.00035 * k;                                    // до 0.35 мм — заметно, но не «прыгает»
  root.position.set((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * 2 * amp);
  for (const r of rings) {
    const { m, i } = r.userData;
    const show = k > 0 && i < Math.max(1, Math.round(vibLevel * RING_N / VIB_MAX));
    const ph = ((now / 1000) * 2.2 + i / RING_N) % 1;          // волна расходится за 0.45 с
    const rad = (0.012 + ph * (0.012 + 0.02 * k));
    r.position.copy(m).add(root.position); r.position.y = 0.052;
    r.scale.setScalar(rad); r.material.opacity = show ? (1 - ph) * 0.85 * Math.min(1, (1 - pt) * 3) : 0;
  }
  // шкала
  const shown = now < vibShownUntil;
  vibEl.style.display = shown ? 'block' : 'none';
  if (shown) {
    const bars = Array.from({ length: VIB_MAX }, (_, j) =>
      `<span style="display:inline-block;width:22px;height:${9 + j * 7}px;margin:0 2px;border-radius:3px;vertical-align:bottom;` +
      `background:${j < vibLevel ? '#ff9a1e' : 'rgba(255,255,255,.22)'}"></span>`).join('');
    const status = vibLevel === 0 ? 'выключена' : `${vibLevel} из ${VIB_MAX}`;
    const note = t(vibAdjust ? 'T удерживается — правый стик ↑ сильнее, ↓ слабее' : (now - vibSaved < 2500 ? 'Настройка сохранена' : ''));
    vibEl.innerHTML = `<div style="font-weight:600">${t(`Вибрация: ${status}`)}</div><div style="margin:6px 0 4px">${bars}</div>` +
      (note ? `<div style="font-size:12.5px;opacity:.85">${note}</div>` : '');
  }
}
let vibSaved = -1e9, vibOffWarned = false, vibTouched = false;
G6.vibration = v => (v === undefined ? vibLevel : (vibLevel = Math.max(0, Math.min(VIB_MAX, v))));

// ---------------- турбо-режим ----------------
// Так на изделии (проверено владельцем): назначить — зажать кнопку (A, B, X, Y, LB, RB, LT, RT) и коротко
// нажать T; снять — держа эту кнопку, дважды быстро нажать T; скорость — зажать T и левым стиком
// вверх/вниз (8 / 15 / 25 нажатий/с), отпустить T — сохранено.
// TURBO — пока держат кнопку, в игру уходят повторные нажатия. AUTO — зажать кнопку, на которой уже
// TURBO, и коротко нажать T: кнопка постоянно быстро нажимается сама. Зажать кнопку в AUTO и коротко
// нажать T — снимаются и AUTO, и турбо (оба шага проверены владельцем).
// Допущения: короткое нажатие T — до 0.5 с и без движения стиков; «дважды быстро» — второе нажатие в
// течение 0.35 с, поэтому одиночное T срабатывает через 0.35 с после отпускания; скорость общая для
// всех кнопок, начальная 15; меняется, если турбо назначено хотя бы одной кнопке; работает на включённом
// геймпаде, как и регулировка вибрации.
const TURBO_KEYS = { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', lt: 'LT', rt: 'RT' };
const TURBO_NODE = { A: 'Btn_A', B: 'Btn_B', X: 'Btn_X', Y: 'Btn_Y', LB: 'LB', RB: 'RB', lt: 'LT', rt: 'RT' };
const TURBO_RATES = [8, 15, 25], TAP_MAX_MS = 500, DOUBLE_MS = 350, DUTY = 0.5;
const turbo = Object.fromEntries(Object.keys(TURBO_KEYS).map(k => [k, 'off']));
const lastRelease = {}, wasDown = {};
let rateIdx = 1, tWasDown = false, lStick = 0, turboFocus = null, turboFocusAt = -1e9, autoT0 = 0;
// серия коротких нажатий T при зажатой кнопке: { k, n, lastUp } ; tDownAt / tStick — текущее нажатие T
let tapSeq = null, tDownAt = 0, tStick = false, rateChanged = false;
const rate = () => TURBO_RATES[rateIdx];
function turboOut(k, now) {                 // что уходит в игру по кнопке k: 0/1
  const held = cur[k] > 0.5, m = turbo[k];
  if (m === 'off') return held ? 1 : 0;
  const ph = ((now - autoT0) / 1000 * rate()) % 1 < DUTY ? 1 : 0;
  return m === 'auto' ? ph : held ? ph : 0;
}
// метки режима над кнопками и «осциллограф» сигнала фокусной кнопки
const tagEls = {};
for (const k of Object.keys(TURBO_KEYS)) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;display:none;transform:translate(-50%,-100%);pointer-events:none;' +
    'font:700 11px "Segoe UI",system-ui,sans-serif;color:#fff;padding:2px 6px;border-radius:6px;white-space:nowrap';
  document.body.appendChild(el); tagEls[k] = el;
}
const scope = document.getElementById('scope'), sg = scope.getContext('2d');
const SCOPE_MS = 2000, hist = [];
const tp = new THREE.Vector3();
function updateTurbo(now) {
  const powered = led.state === 'on' || led.state === 'connect' || led.state === 'pair';
  const tDown = cur.Share > 0.5;
  for (const k of Object.keys(TURBO_KEYS)) {
    const d = cur[k] > 0.5;
    if (d && !wasDown[k] && turbo[k] !== 'off') turboFocus = k;   // осциллограф — только кнопкам в турбо
    wasDown[k] = d;
  }
  const setMode = (k, m) => {
    turbo[k] = m; if (m === 'auto') autoT0 = now;
    turboFocus = k; turboFocusAt = now;
    warn(`Кнопка ${TURBO_KEYS[k]}: ${{ off: 'турбо снято — обычный режим', turbo: 'TURBO — повторы, пока держите', auto: 'AUTO — повторы без удержания' }[m]}`, true);
  };
  if (tDown && !tWasDown) { tDownAt = now; tStick = false; rateChanged = false; }
  if (Math.abs(cur.ly) > 0.3 || Math.abs(cur.ry) > 0.3) if (tDown) tStick = true;   // T как модификатор стика — не «нажатие»
  if (!tDown && tWasDown) {
    const tap = now - tDownAt <= TAP_MAX_MS && !tStick;
    const held = Object.keys(TURBO_KEYS).find(b => cur[b] > 0.5);
    if (tap && powered && held) {
      if (tapSeq && tapSeq.k === held && now - tapSeq.lastUp <= DOUBLE_MS + TAP_MAX_MS) { tapSeq.n++; tapSeq.lastUp = now; }
      else tapSeq = { k: held, n: 1, lastUp: now };
    }
    if (rateChanged) warn(`Скорость сохранена: ${rate()} нажатий/с`, true);
  }
  // решение по серии — когда второе нажатие уже не придёт
  if (tapSeq && !tDown && now - tapSeq.lastUp > DOUBLE_MS) {
    const { k, n } = tapSeq; tapSeq = null;
    if (n >= 2) { if (turbo[k] !== 'off') setMode(k, 'off'); }
    else setMode(k, { off: 'turbo', turbo: 'auto', auto: 'off' }[turbo[k]]);
  }
  tWasDown = tDown;
  // скорость: T + левый стик, с гистерезисом как у вибрации
  const anyTurbo = Object.values(turbo).some(m => m !== 'off');
  if (tDown && powered && anyTurbo && lStick === 0 && Math.abs(cur.ly) > 0.6) {
    lStick = Math.sign(cur.ly);
    const ni = Math.max(0, Math.min(TURBO_RATES.length - 1, rateIdx + (cur.ly < 0 ? 1 : -1)));
    if (ni !== rateIdx) { rateIdx = ni; rateChanged = true; warn(`Скорость турбо: ${rate()} нажатий/с — отпустите T, чтобы сохранить`, true); }
    turboFocusAt = now;
  }
  if (Math.abs(cur.ly) < 0.3) lStick = 0;
  // вспышка буквы на каждое нажатие, ушедшее в игру (только для кнопок не в обычном режиме)
  for (const k of ['A', 'B', 'X', 'Y']) {
    for (const m of materials['letter_' + k] ?? []) {
      const base = m.userData.glow ?? 0.6;
      m.emissiveIntensity = (turbo[k] !== 'off' && turboOut(k, now)) || macroOut(k, now) ? Math.max(3, base * 4) : base;
    }
  }
  // метки
  const r = renderer.domElement.getBoundingClientRect();
  for (const [k, el] of Object.entries(tagEls)) {
    const m = turbo[k];
    if (m === 'off') { el.style.display = 'none'; continue; }
    nodes[TURBO_NODE[k]].obj.getWorldPosition(tp); tp.y += 0.006; tp.project(camera);
    el.style.display = tp.z < 1 ? 'block' : 'none';
    el.style.left = (r.left + (tp.x + 1) / 2 * r.width) + 'px'; el.style.top = (r.top + (1 - tp.y) / 2 * r.height) + 'px';
    el.style.background = m === 'auto' ? '#d93a2b' : '#e07b00';
    el.textContent = t(m === 'auto' ? `AUTO ${rate()}/с` : `TURBO ${rate()}/с`);
  }
  // осциллограф: видно, пока фокусная кнопка в турбо или недавно трогали
  const k = turboFocus, show = k && (turbo[k] !== 'off' || now - turboFocusAt < 4000);
  scope.style.display = show ? 'block' : 'none';
  if (!show) return;
  hist.push([now, cur[k] > 0.5 ? 1 : 0, turbo[k], rate(), autoT0]);
  while (hist.length > 2 && now - hist[1][0] > SCOPE_MS) hist.shift();
  const W = scope.width, H = scope.height;
  sg.clearRect(0, 0, W, H); sg.fillStyle = 'rgba(20,20,22,.88)'; sg.beginPath(); sg.roundRect(0, 0, W, H, 10); sg.fill();
  sg.fillStyle = '#fff'; sg.font = '600 14px "Segoe UI",system-ui,sans-serif'; sg.textBaseline = 'middle'; sg.textAlign = 'left';
  const mName = { off: 'обычный режим', turbo: `TURBO · ${rate()} нажатий/с, пока держите`, auto: `AUTO · ${rate()} нажатий/с` }[turbo[k]];
  sg.fillText(t(`Кнопка ${TURBO_KEYS[k]} — ${mName}`), 12, 16);
  // Нижняя дорожка — не по кадрам, а по каждому пикселю времени: при 25 нажатиях/с и 60 кадрах/с
  // на период приходится 2.4 отсчёта, и выборка по кадрам рисовала бы неровную «гребёнку».
  const x0 = 120, x1 = W - 10, msPx = SCOPE_MS / (x1 - x0);
  let hi = 0;
  const sampleAt = t => { while (hi < hist.length - 1 && hist[hi + 1][0] <= t) hi++; return hist[hi]; };
  const rows = [['палец держит', 0, '#9aa0a6'], ['уходит в игру', 1, '#ff9a1e']];
  for (const [label, row, color] of rows) {
    const yb = 64 + row * 40, yt = yb - 22;
    sg.fillStyle = '#c8c8cc'; sg.font = '12px "Segoe UI",system-ui,sans-serif'; sg.fillText(t(label), 12, yb - 11);
    sg.strokeStyle = color; sg.lineWidth = 2; sg.beginPath(); hi = 0;
    let py = null;
    for (let x = x0; x <= x1; x++) {
      const t = now - (x1 - x) * msPx, s0 = sampleAt(t);
      if (!s0 || s0[0] > t) continue;
      const [, held, m, rt, a0] = s0;
      const ph = ((t - a0) / 1000 * rt) % 1 < DUTY ? 1 : 0;
      const v = row === 0 ? held : m === 'off' ? held : m === 'auto' ? ph : held && ph;
      const y = v ? yt : yb;
      if (py === null) sg.moveTo(x, y); else if (y !== py) { sg.lineTo(x, py); sg.lineTo(x, y); }
      py = y;
    }
    if (py !== null) sg.lineTo(x1, py);
    sg.stroke();
  }
}

// ---------------- подсветка нажатого: рябь по корпусу ----------------
// Сдвиг кнопки на 1–1.6 мм или поворот триггера на 16° издали почти не виден. Поэтому вокруг нажатой
// кнопки по корпусу расходятся круги, как рябь на воде: пока держат — новый каждые 0.45 с, короткое
// нажатие — две волны, которые расходятся и гаснут. Круги лежат в 3D на поверхности (у кнопок сверху —
// горизонтально, у триггеров — на задней грани, у бамперов — на скосе, у M1/M2 — на дне).
// Стики: дуга на ободке вокруг основания в сторону наклона, ярче и шире при сильном наклоне.
// Отказались: жёлтые кольца-спрайты поверх всего (в пространстве читались плохо) и выноски со
// стрелками и подписями (перегружали картинку) — отзыв владельца.
const RIPPLE_EVERY_MS = 450, RIPPLE_LIFE_MS = 900, RIPPLE_COLOR = '#ffae00';
// [вход, узел, r0 мм, r1 мм, нормаль поверхности, где лежит круг: 'top' | 'back' | 'bevel' | 'bottom']
const RIPPLE_SRC = [
  ['A', 'Btn_A', 6, 14, 'top'], ['B', 'Btn_B', 6, 14, 'top'], ['X', 'Btn_X', 6, 14, 'top'], ['Y', 'Btn_Y', 6, 14, 'top'],
  ['View', 'Btn_View', 4.5, 10, 'top'], ['Menu', 'Btn_Menu', 4.5, 10, 'top'], ['Share', 'Btn_Share', 4.5, 10, 'top'],
  ['Home', 'Btn_Home', 6.5, 13, 'top'], ['L3', 'Stick_L', 12, 20, 'top'], ['R3', 'Stick_R', 12, 20, 'top'],
  ['LB', 'LB', 7, 15, 'bevel'], ['RB', 'RB', 7, 15, 'bevel'], ['lt', 'LT', 8, 16, 'back'], ['rt', 'RT', 8, 16, 'back'],
  ['M1', 'M1', 8, 16, 'bottom'], ['M2', 'M2', 8, 16, 'bottom'],
];
const NORMALS = { top: new THREE.Vector3(0, 1, 0), back: new THREE.Vector3(0, 0, -1),
  bevel: new THREE.Vector3(0, 0.7, -0.7).normalize(), bottom: new THREE.Vector3(0, -1, 0) };
// опорная точка круга в локальных координатах узла: центр габарита, прижатый к нужной грани
function anchor(node, face) {
  const o = nodes[node].obj; o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
  // сверху — по оси узла: у View и Menu в узле ещё основание шириной 24.7 мм под обеими кнопками, центр
  // габарита уезжал от колпачка на 8.2 мм к середине геймпада; у верхних кнопок ось — центр колпачка (замер)
  if (face === 'top') { const p = o.getWorldPosition(new THREE.Vector3()); c.set(p.x, b.max.y + 0.0003, p.z); }
  else if (face === 'bottom') c.y = b.min.y - 0.0003;
  else if (face === 'back') c.z = b.min.z - 0.0003; else { c.y = b.max.y - 0.002; c.z = b.min.z + 0.004; }
  return o.worldToLocal(c);
}
const rippleSrc = RIPPLE_SRC.map(([k, node, r0, r1, face]) => ({ k, node, r0, r1, n: NORMALS[face], c: anchor(node, face),
  on: false, lastEmit: -1e9 }));
// бамперы — половины детали шириной 54 мм; нажимают у плеча, x = ±40 мм (локальный x = мировой)
for (const s of rippleSrc) if (s.k === 'LB' || s.k === 'RB') s.c.x = (s.k === 'RB' ? 1 : -1) * 0.040;
// крестовина: круг у нажатого края, по 8 мм от центра
const DPAD_DIR = { Up: [0, -1, '↑'], Down: [0, 1, '↓'], Left: [-1, 0, '←'], Right: [1, 0, '→'] };
const dpadSrc = { node: 'DPad', r0: 5, r1: 11, n: NORMALS.top, c: anchor('DPad', 'top'), on: false, lastEmit: -1e9 };
const ringGeo = new THREE.RingGeometry(0.9, 1, 64);
const pool = [];
function emit(src, off, color = RIPPLE_COLOR) {
  let m = pool.find(p => !p.visible);
  if (!m) {
    m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: RIPPLE_COLOR, transparent: true, depthWrite: false,
      toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.renderOrder = 5; scene.add(m); pool.push(m);
  }
  const p = src.c.clone(); if (off) p.add(off);
  nodes[src.node].obj.localToWorld(p);
  m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), src.n);
  m.material.color.set(color);
  m.userData = { t0: performance.now(), r0: src.r0 * MM, r1: src.r1 * MM }; m.visible = true;
}
// Стики: кольцо вокруг отверстия, лежащее на корпусе, светится дугой в сторону наклона. Корпус вокруг
// стика не плоский — 49…55 мм при шарнире на 41.6 мм (замер лучом), поэтому плоская дуга на одной высоте
// уходила под него; здесь каждая вершина кольца опущена лучом на поверхность Body (+0.35 мм).
// Дуга — прозрачность вершин по углу к направлению наклона (≈70° по полуяркости), ярче при сильном наклоне.
// внешний радиус 18 мм: при 15.5 дугу «вверх» (от игрока) с ракурса спереди закрывала шляпка стика
const ARC_SEG = 96, ARC_R0 = 11 * MM, ARC_R1 = 18 * MM, ARC_HALF = 0.62;
const bodyMesh = scene.getObjectByName('Body'), downRay = new THREE.Raycaster();
const stickArcs = [['lx', 'ly', 'Stick_L'], ['rx', 'ry', 'Stick_R']].map(([ax, ay, node]) => {
  const c = nodes[node].obj.getWorldPosition(new THREE.Vector3());
  const pos = [], ang = [], idx = [];
  for (let i = 0; i <= ARC_SEG; i++) {
    const a = i / ARC_SEG * Math.PI * 2;
    for (const r of [ARC_R0, ARC_R1]) {
      const x = c.x + Math.cos(a) * r, z = c.z - Math.sin(a) * r;     // угол a: 0 — вправо, π/2 — от игрока (вверх стика)
      downRay.set(new THREE.Vector3(x, 0.2, z), new THREE.Vector3(0, -1, 0));
      const h = downRay.intersectObject(bodyMesh, true)[0];
      pos.push(x, (h ? h.point.y : c.y + 0.01) + 0.00035, z); ang.push(a);
    }
    if (i < ARC_SEG) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const col = new THREE.Float32BufferAttribute(new Float32Array(ang.length * 4), 4); geo.setAttribute('color', col);
  geo.setIndex(idx);
  const base = new THREE.Color(RIPPLE_COLOR);
  for (let v = 0; v < ang.length; v++) col.setXYZW(v, base.r, base.g, base.b, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false,
    toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.renderOrder = 5; scene.add(m);
  return { ax, ay, m, col, ang };
});
const pressedEl = document.getElementById('pressed');
let pressedKey = '';
const PRESS_LABEL = { A: 'A', B: 'B', X: 'X', Y: 'Y', View: 'View', Menu: 'Menu', Share: 'T', Home: 'HOME', L3: 'L3', R3: 'R3',
  LB: 'LB', RB: 'RB', lt: 'LT', rt: 'RT', M1: 'M1', M2: 'M2' };
function rippleStep(src, on, now, off) {
  if (on && !src.on) { emit(src, off); src.lastEmit = now; src.second = now + 140; }           // фронт: волна сразу
  else if (src.second && now >= src.second) { emit(src, off); src.second = 0; }               // вторая волна
  else if (on && now - src.lastEmit >= RIPPLE_EVERY_MS) { emit(src, off); src.lastEmit = now; }  // пока держат
  src.on = on;
}
function updatePressed(now) {
  if (demo) {                                    // рекламный показ — без подсветки нажатого
    pressedEl.style.display = 'none'; pressedKey = ''; for (const m of pool) m.visible = false;
    for (const st of stickArcs) if (st.lit) { for (let v = 0; v < st.ang.length; v++) st.col.setW(v, 0); st.col.needsUpdate = true; st.lit = false; }
    return;
  }
  const chips = [];
  for (const s of rippleSrc) { const on = cur[s.k] > 0.5; rippleStep(s, on, now); if (on) chips.push(PRESS_LABEL[s.k]); }
  const dirs = Object.keys(DPAD_DIR).filter(d => cur[d] > 0.5);
  const off = new THREE.Vector3(dirs.reduce((a, d) => a + DPAD_DIR[d][0], 0) * 8 * MM, 0, dirs.reduce((a, d) => a + DPAD_DIR[d][1], 0) * 8 * MM);
  if (dirs.length) dpadSrc.off = off;
  rippleStep(dpadSrc, dirs.length > 0, now, dpadSrc.off);
  if (dirs.length) chips.push('Крестовина ' + dirs.map(d => DPAD_DIR[d][2]).join(''));
  for (const m of pool) {
    if (!m.visible) continue;
    const u = (now - m.userData.t0) / RIPPLE_LIFE_MS;
    if (u >= 1) { m.visible = false; continue; }
    const e = 1 - (1 - u) * (1 - u);                          // быстрое начало, плавное затухание
    m.scale.setScalar(m.userData.r0 + (m.userData.r1 - m.userData.r0) * e);
    m.material.opacity = 0.95 * (1 - u);
  }
  for (const st of stickArcs) {
    const x = cur[st.ax], y = cur[st.ay], mag = Math.min(1, Math.hypot(x, y));
    const k = Math.max(0, (mag - 0.15) / 0.85), dir = Math.atan2(-y, x);
    const glow = k * (0.8 + 0.2 * Math.sin(now / 1000 * Math.PI * 6)), cut = Math.cos(ARC_HALF + 0.35 * (1 - k));
    if (glow > 0 || st.lit) {
      for (let v = 0; v < st.ang.length; v++) {
        const c = Math.cos(st.ang[v] - dir);
        st.col.setW(v, glow * Math.pow(Math.max(0, (c - cut) / (1 - cut)), 0.6));
      }
      st.col.needsUpdate = true; st.lit = glow > 0;
    }
    if (k > 0.4) chips.push(`${st.ax === 'lx' ? 'Левый' : 'Правый'} стик ${Math.abs(x) > Math.abs(y) ? (x > 0 ? '→' : '←') : (y > 0 ? '↓' : '↑')}`);
  }
  const key = getLang() + chips.join('|');
  if (key !== pressedKey) {
    pressedKey = key;
    pressedEl.style.display = chips.length ? 'block' : 'none';
    pressedEl.innerHTML = `<span style="opacity:.75;margin-right:6px">${t('Нажато:')}</span>` +
      chips.map(c => `<span style="display:inline-block;background:#ffe600;color:#111;font-weight:700;border-radius:6px;padding:2px 8px;margin:0 2px">${t(c)}</span>`)
        .join('<span style="margin:0 2px">+</span>');
  }
}


// ---------------- макросы M1 / M2 ----------------
// Так на изделии (проверено владельцем): зажать M1, зажать SELECT (кнопка View) и держать, пока HOME
// не начнёт быстро мигать белым; отпустить оба; нажать кнопку или сочетание кнопок — записываются все,
// кроме HOME и наклонов стиков (нажатия на стики — да); ещё раз M1 — сохранено. Сброс: так же войти,
// отпустить и сразу ещё раз M1 (в модели — та же запись, но пустая). M2 — так же. Вне записи M1
// выполняет макрос. Сначала была версия по печатной инструкции (SELECT, затем M1; только A/B/X/Y/
// крестовина/бамперы/триггеры) — на изделии порядок и набор кнопок другие.
// Тоже проверено владельцем: при входе в запись или сброс M1 нажимают раньше SELECT, и сохранённый
// макрос при этом срабатывает — поэтому M1 выполняет его сразу по нажатию.
// Допущения: быстрое мигание — через 1 с удержания обоих (так в печатной инструкции); шаг записи —
// кнопки, нажатые внахлёст (сочетание), до 12 шагов; нажатия, пока M1 и SELECT ещё не отпущены, не
// пишутся; выполнение — 120 мс нажатие + 80 мс пауза на шаг; если SELECT зажат, пока макрос ещё
// идёт, выполнение обрывается; после сохранения HOME возвращается в прежнее состояние; только на
// включённом геймпаде.
const MACRO_KEYS = ['A', 'B', 'X', 'Y', 'Up', 'Down', 'Left', 'Right', 'LB', 'RB', 'lt', 'rt', 'View', 'Menu', 'Share', 'L3', 'R3'];
const MACRO_LABEL = { A: 'A', B: 'B', X: 'X', Y: 'Y', Up: '↑', Down: '↓', Left: '←', Right: '→', LB: 'LB', RB: 'RB', lt: 'LT', rt: 'RT',
  View: 'SELECT', Menu: 'Menu', Share: 'T', L3: 'L3', R3: 'R3' };
const MACRO_MAX = 12, MACRO_ARM_MS = 1000, MACRO_PRESS_MS = 120, MACRO_GAP_MS = 80, MACRO_COLOR = '#29c4ff';
const macros = { M1: [], M2: [] };              // шаг — массив кнопок, нажатых вместе
// mSlow — замедление выполнения для инструкции: на реальной скорости шаг 0.2 с, глазом не проследить
let mprog = null, mplay = null, mShowUntil = 0, mNote = '', mSlow = 1;
const mWas = {};
const macroEl = document.getElementById('macro');
function macroOut(k, now) {                     // что макрос сейчас «нажимает» в игре
  if (!mplay) return 0;
  const t = (now - mplay.t0) / mplay.slow, step = Math.floor(t / (MACRO_PRESS_MS + MACRO_GAP_MS));
  return mplay.list[step]?.includes(k) && t % (MACRO_PRESS_MS + MACRO_GAP_MS) < MACRO_PRESS_MS ? 1 : 0;
}
// источник ряби для элемента (у крестовины — смещение к нажатому краю)
const DPAD_OFF = { Up: [0, -8], Down: [0, 8], Left: [-8, 0], Right: [8, 0] };
function macroRipple(step) {
  for (const k of step) {
    if (DPAD_OFF[k]) { const [x, z] = DPAD_OFF[k]; emit(dpadSrc, new THREE.Vector3(x * MM, 0, z * MM), MACRO_COLOR); continue; }
    const src = rippleSrc.find(s => s.k === k); if (src) emit(src, null, MACRO_COLOR);
  }
}
function updateMacro(now) {
  const powered = led.state === 'on' || led.state === 'connect' || led.state === 'pair' || led.state === 'macro';
  const held = k => cur[k] > 0.5, edge = k => held(k) && !mWas[k];
  const busy = !!mprog;                         // нажатие M, которым сохранили, не должно ещё и выполнить
  if (!mprog && powered) {                                          // M + SELECT зажаты вместе — вход
    const slot = ['M1', 'M2'].find(sl => held(sl) && held('View'));
    if (slot) {
      mplay = null;
      mprog = { slot, t0: now, armed: false, free: false, list: [], group: null, prev: led.state };
      mNote = `${slot} + SELECT: держать до быстрого мигания`; mShowUntil = Infinity;
    }
  }
  if (mprog && !mprog.armed) {
    if (!held(mprog.slot) || !held('View')) { mprog = null; mShowUntil = now; }   // отпустили раньше — не вошли
    else if (now - mprog.t0 >= MACRO_ARM_MS) {
      mprog.armed = true; setLed('macro'); mNote = `Запись ${mprog.slot}: отпустите ${mprog.slot} и SELECT`;
    }
  } else if (mprog && !mprog.free) {
    if (!held(mprog.slot) && !held('View')) { mprog.free = true; mNote = `Запись ${mprog.slot}: нажимайте кнопки, затем ${mprog.slot}`; }
  } else if (mprog) {
    if (edge(mprog.slot)) {                                         // ещё раз M — сохранить
      const { slot, list, group, prev } = mprog; if (group) list.push(group);
      macros[slot] = list; mprog = null;
      setLed(prev === 'macro' ? 'on' : prev);
      mNote = macros[slot].length ? `${slot}: сохранено` : `${slot}: сброшено`; mShowUntil = now + 3500;
      warn(mNote, true);
    } else {
      // сочетание: кнопки, нажатые внахлёст, — один шаг; шаг закрывается, когда отпущены все
      const down = MACRO_KEYS.filter(held);
      if (mprog.group) {
        for (const k of down) if (!mprog.group.includes(k)) mprog.group.push(k);
        if (!down.length) { mprog.list.push(mprog.group); mprog.group = null; }
      } else if (down.length && MACRO_KEYS.some(edge) && mprog.list.length < MACRO_MAX) mprog.group = down;
    }
  }
  if (!mprog && !busy) for (const slot of ['M1', 'M2']) {
    if (edge(slot) && !held('View') && powered && macros[slot].length) {   // выполнить
      mplay = { slot, list: macros[slot], t0: now, last: -1, slow: mSlow };
      mNote = `${slot}: выполняется${mSlow > 1 ? ` (замедленно ×${mSlow})` : ''}`; mShowUntil = Infinity;
    }
  }
  if (mplay) {
    const step = Math.floor((now - mplay.t0) / mplay.slow / (MACRO_PRESS_MS + MACRO_GAP_MS));
    if (step !== mplay.last && step < mplay.list.length) { mplay.last = step; macroRipple(mplay.list[step]); }
    if (step >= mplay.list.length) { mplay = null; mNote = `${mNote.split(':')[0]}: выполнено`; mShowUntil = now + 2500; }
  }
  for (const k of [...MACRO_KEYS, 'M1', 'M2']) mWas[k] = held(k);
  // строка макроса
  const show = now < mShowUntil;
  macroEl.style.display = show ? 'block' : 'none';
  if (!show) return;
  const slot = mprog?.slot ?? mplay?.slot ?? mNote.split(/[ :]/)[0];
  const list = mprog ? [...mprog.list, ...(mprog.group ? [mprog.group] : [])] : macros[slot] ?? [];
  const curStep = mplay ? Math.floor((now - mplay.t0) / mplay.slow / (MACRO_PRESS_MS + MACRO_GAP_MS)) : -1;
  const chips = list.map((st, i) => `<span style="display:inline-block;min-width:22px;text-align:center;border-radius:6px;padding:2px 7px;margin:0 1px;` +
    `font-weight:700;background:${i === curStep ? MACRO_COLOR : 'rgba(255,255,255,.16)'};color:${i === curStep ? '#06202b' : '#fff'}">` +
    `${st.map(k => MACRO_LABEL[k]).join(' + ')}</span>`)
    .join('<span style="opacity:.6;margin:0 2px">→</span>');
  macroEl.innerHTML = `<div style="font-weight:600;margin-bottom:5px">${t(mNote)}${mprog?.free ? ` · ${list.length} / ${MACRO_MAX}` : ''}</div>` +
    (mprog && !mprog.free ? '' : `<div>${chips || `<span style="opacity:.6">${t('пусто')}</span>`}</div>`);
}
// G6.macro('M1') → [['A'], ['X', 'Y']]; G6.macro('M1', ['A', ['X', 'Y']]) — строка = шаг из одной кнопки
G6.macro = (slot, list) => (list === undefined ? macros[slot].map(st => st.slice())
  : (macros[slot] = list.map(st => (Array.isArray(st) ? st.slice() : [st]))));
G6.macroSlow = k => (k === undefined ? mSlow : (mSlow = k));
G6.macroState = () => (mprog ? (mprog.free ? 'recording' : mprog.armed ? 'release' : 'arming') : mplay ? 'playing' : 'idle');

G6.turbo = (k, m) => (m === undefined ? turbo[k] : (turbo[k] = m));
G6.turboRate = () => rate();


// ---------------- подсветка подписи режима на дне ----------------
// Подписи режимов — детали O53–O61 (Blender, мм): «M X S» в ряд под прорезью (y −24.9, z 27.13),
// «V3» и «2.4G» у её концов (y −29.15, z 28.05, в углублении). Центры и ширины — по габаритам деталей.
// Плашка висит в 0.08 мм под поверхностью подписи (дно смотрит в −Z Blender = −Y glTF).
const MODE_LABEL = { V3: [8.59, -29.15, 28.05, 3.4], M: [3.40, -24.93, 27.13, 2.6], X: [-0.50, -24.93, 27.13, 2.4],
                     S: [-4.39, -24.93, 27.13, 2.3], '2.4G': [-10.16, -29.15, 28.05, 5.2] };
const markGeo = w => new THREE.ShapeGeometry(roundRect((w + 1.0) * MM, 2.6 * MM, 0.9 * MM));
let markW = 0;
const modeMark = new THREE.Mesh(markGeo(2.4),
  new THREE.MeshBasicMaterial({ color: '#1e88ff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
modeMark.rotation.x = Math.PI / 2; modeMark.visible = false; scene.add(modeMark);
const markPos = new THREE.Vector3(), markGoal = new THREE.Vector3();
function updateModeMark(dt, now) {
  if (!modeMark.visible) return;
  const [x, y, z, w] = MODE_LABEL[MODE.names[modeIdx]];
  markGoal.set(x * MM, (z - 0.08) * MM, -y * MM);
  markPos.lerp(markGoal, 1 - Math.exp(-dt / 0.08));   // переезжает вместе с ручкой
  modeMark.position.copy(markPos);
  if (w !== markW) { modeMark.geometry.dispose(); modeMark.geometry = markGeo(w); markW = w; }
  modeMark.material.opacity = 0.55 + 0.35 * Math.sin(now / 1000 * Math.PI * 2);   // пульс 1 Гц
}
G6.modeHighlight = on => {
  modeMark.visible = !!on;
  const [x, y, z, w] = MODE_LABEL[MODE.names[modeIdx]];
  markPos.set(x * MM, (z - 0.08) * MM, -y * MM);
};

// инструкция по Bluetooth-подключению (экран ноутбука, сценарий) — отдельный модуль
G6.THREE = THREE;
await import('./tutorial.js');
