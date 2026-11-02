// Анимированная инструкция: беспроводное (Bluetooth) подключение геймпада к ПК с Windows 11.
// Экран ноутбука — canvas-текстура; интерфейс нарисован по скриншотам G6/photo_2026-11-02_16-44-32*.jpg
// (контекстное меню значка Bluetooth, «Параметры» -> Bluetooth и устройства -> Устройства, окно
// «Добавить устройство»). Имя пользователя, имя ПК и чужие устройства со скриншотов не переносятся.
// Порядок шагов и имена устройств — по описанию владельца изделия:
//   X — «Xbox Wireless Controller», V3 — «BSP-G6», M — «Wireless Controller» (бывает «DUALSHOCK 4»),
//   S — «Pro Controller» (так на скриншоте). Режим 2.4G — не Bluetooth, в инструкции его нет.
import { t, onLang, getLang, applyStatic } from './i18n.js';
const { THREE } = window.G6;
const { scene, camera, controls } = window.G6.three;
const DEVICE = { X: 'Xbox Wireless Controller', V3: 'BSP-G6', M: 'Wireless Controller', S: 'Pro Controller' };
const MODE_HINT = { X: 'X — X-input', V3: 'V3', M: 'M', S: 'S' };

// ---------- экран ----------
const screenMesh = scene.getObjectByName('Laptop_screen');
const pos = screenMesh.geometry.attributes.position;
screenMesh.updateMatrixWorld(true);
const wp = [];
for (let i = 0; i < pos.count; i++) wp.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(screenMesh.matrixWorld));
const minX = Math.min(...wp.map(p => p.x)), maxX = Math.max(...wp.map(p => p.x));
const minY = Math.min(...wp.map(p => p.y)), maxY = Math.max(...wp.map(p => p.y));
const zAt = y => { const lo = wp.reduce((a, b) => (b.y < a.y ? b : a)), hi = wp.reduce((a, b) => (b.y > a.y ? b : a));
  return lo.z + (hi.z - lo.z) * (y - lo.y) / (hi.y - lo.y); };
const hgt = Math.hypot(maxY - minY, zAt(maxY) - zAt(minY));
// Плоскость экрана в модели больше окна в рамке крышки: замер лучами по нормали экрана показал, что
// видно примерно u 0.075…0.95, v 0.075…0.975 — нижние 7.5 % (там была панель задач) закрывает рамка.
// Видимую область меряем при загрузке (шаг 0.5 %) и растягиваем на неё весь canvas.
const lo = wp.reduce((a, b) => (b.y < a.y ? b : a)), hi = wp.reduce((a, b) => (b.y > a.y ? b : a));
const nrm = new THREE.Vector3(1, 0, 0).cross(new THREE.Vector3(0, hi.y - lo.y, hi.z - lo.z)).normalize();
if (nrm.z < 0) nrm.negate();
const ray = new THREE.Raycaster();
const pointAt = (fu, fv) => new THREE.Vector3(minX + (maxX - minX) * fu, lo.y + (hi.y - lo.y) * fv, lo.z + (hi.z - lo.z) * fv);
function seen(fu, fv) {
  ray.set(pointAt(fu, fv).addScaledVector(nrm, 0.3), nrm.clone().negate());
  return ray.intersectObject(scene, true).find(h => h.object.isMesh)?.object === screenMesh;
}
function span(f) {                                  // первая и последняя видимые доли вдоль оси
  const ok = []; for (let k = 0; k <= 200; k++) if (f(k / 200)) ok.push(k / 200);
  return ok.length ? [ok[0], ok[ok.length - 1]] : [0, 1];
}
const [u0, u1] = span(t => seen(t, 0.5)), [v0, v1] = span(t => seen(0.5, t));
console.info('экран ноутбука: видимая область u', u0, u1, 'v', v0, v1);
const uv = new Float32Array(pos.count * 2);
wp.forEach((p, i) => {
  uv[2 * i] = ((p.x - minX) / (maxX - minX) - u0) / (u1 - u0);
  uv[2 * i + 1] = ((p.y - minY) / (maxY - minY) - v0) / (v1 - v0);
});
screenMesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
const W = 1400, H = Math.round(W * hgt * (v1 - v0) / ((maxX - minX) * (u1 - u0)));
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
const tex = new THREE.CanvasTexture(cv);
tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
// Без mipmap: при обновлении canvas уменьшенные копии не пересчитывались, и издали (общий план)
// экран показывал кадр многосекундной давности, а вблизи — свежий. Замер в браузере, Chrome/ANGLE.
tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
// плоскость экрана в исходной модели обращена лицом назад: с односторонним материалом её не видно
screenMesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
const SCREEN_C = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, zAt((minY + maxY) / 2));

// ---------- рисование ----------
const F = (s, w = 400) => `${w} ${s}px "Segoe UI", "Segoe UI Variable", system-ui, sans-serif`;
const BLUE = '#005fb8';
function rr(x, y, w, h, r, fill, stroke) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
}
function text(s, x, y, size, color = '#1b1b1b', weight = 400, align = 'left') {
  g.font = F(size, weight); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t(s), x, y);
}
function btIcon(x, y, s, color = '#1b1b1b') {             // руна Bluetooth
  g.strokeStyle = color; g.lineWidth = Math.max(1.5, s / 9); g.lineJoin = 'round'; g.beginPath();
  g.moveTo(x - s * 0.3, y - s * 0.25); g.lineTo(x + s * 0.3, y + s * 0.25); g.lineTo(x, y + s * 0.5);
  g.lineTo(x, y - s * 0.5); g.lineTo(x + s * 0.3, y - s * 0.25); g.lineTo(x - s * 0.3, y + s * 0.25); g.stroke();
}
function padIcon(x, y, s, color = '#444') {               // значок геймпада
  g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.roundRect(x - s / 2, y - s * 0.3, s, s * 0.6, s * 0.3); g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.28, y); g.lineTo(x - s * 0.12, y); g.moveTo(x - s * 0.2, y - s * 0.08); g.lineTo(x - s * 0.2, y + s * 0.08); g.stroke();
  g.beginPath(); g.arc(x + s * 0.18, y - s * 0.04, 2, 0, 7); g.arc(x + s * 0.26, y + s * 0.06, 2, 0, 7); g.fillStyle = color; g.fill();
}
const TB = { h: 48 }, TRAY = { bt: W - 262 };
function desktop() {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b3d91'); bg.addColorStop(0.55, '#2a7de1'); bg.addColorStop(1, '#9ec9ff');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.55, H * 0.55, 20, W * 0.55, H * 0.55, H * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // панель задач
  g.fillStyle = 'rgba(238,241,246,0.93)'; g.fillRect(0, H - TB.h, W, TB.h);
  const cy = H - TB.h / 2, cx = W / 2 - 80;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) rr(cx + i * 11, cy - 10 + j * 11, 9, 9, 1, '#0078d4');
  rr(cx + 40, cy - 11, 22, 22, 11, null, '#555'); rr(cx + 84, cy - 10, 22, 20, 3, '#f2c94c');
  rr(cx + 128, cy - 10, 22, 20, 4, '#3a7bd5'); rr(cx + 172, cy - 10, 22, 20, 11, '#e94e3c');
  text('˄', W - 300, cy + 2, 16, '#333', 400, 'center');
  btIcon(TRAY.bt, cy, 16, S.hover === 'tray' ? BLUE : '#222');
  if (S.hover === 'tray') rr(TRAY.bt - 16, cy - 18, 32, 36, 5, null, 'rgba(0,0,0,0.25)');
  g.strokeStyle = '#222'; g.lineWidth = 2;
  for (const r of [5, 10]) { g.beginPath(); g.arc(W - 226, cy + 6, r, -2.4, -0.74); g.stroke(); }
  g.beginPath(); g.moveTo(W - 202, cy - 5); g.lineTo(W - 196, cy - 5); g.lineTo(W - 190, cy - 10); g.lineTo(W - 190, cy + 10);
  g.lineTo(W - 196, cy + 5); g.lineTo(W - 202, cy + 5); g.closePath(); g.stroke();
  rr(W - 175, cy - 6, 22, 12, 2, null, '#222'); rr(W - 173, cy - 4, 14, 8, 1, '#222');
  const d = new Date();
  text(d.toLocaleTimeString(getLang() === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }), W - 95, cy - 9, 14, '#111', 400, 'center');
  text(d.toLocaleDateString(getLang() === 'en' ? 'en-US' : 'ru-RU'), W - 95, cy + 10, 14, '#111', 400, 'center');
}
const MENU = ['Добавление устройства Bluetooth', '~Разрешить подключение устройства', '*Показать устройства Bluetooth', '-',
  'Отправить файл', 'Принять файл', '-', 'Присоединиться к личной сети (PAN)', '-', 'Открыть параметры', '-', 'Удалить значок'];
const MW = 360, MIH = 38;
const menuBox = () => { const h = MENU.reduce((a, m) => a + (m === '-' ? 11 : MIH), 16); return { x: TRAY.bt - MW + 60, y: H - TB.h - 8 - h, w: MW, h }; };
function menu() {
  const b = menuBox(); g.save(); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 24;
  rr(b.x, b.y, b.w, b.h, 8, '#f9f9f9', '#d0d0d0'); g.restore();
  let y = b.y + 8;
  for (const m of MENU) {
    if (m === '-') { g.fillStyle = '#ddd'; g.fillRect(b.x + 1, y + 5, b.w - 2, 1); y += 11; continue; }
    if (S.hover === 'menu0' && m === MENU[0]) rr(b.x + 5, y + 2, b.w - 10, MIH - 4, 4, '#e8e8e8');
    const grey = m[0] === '~', bold = m[0] === '*';
    text(m.replace(/^[~*]/, ''), b.x + 30, y + MIH / 2, 16, grey ? '#a0a0a0' : '#1b1b1b', bold ? 600 : 400);
    y += MIH;
  }
}
const WIN = { x: 70, y: 26, w: W - 140, h: H - TB.h - 52 };
const CONTENT_X = WIN.x + 340;
const ADD_BTN = { x: WIN.x + WIN.w - 230, y: WIN.y + 238, w: 196, h: 40 };
const SIDE = ['Главная', 'Система', 'Bluetooth и устройства', 'Сеть и Интернет', 'Персонализация', 'Приложения',
  'Учетные записи', 'Время и язык', 'Игры', 'Специальные возможности', 'Конфиденциальность и защита', 'Центр обновления Windows'];
function card(x, y, w, h) { rr(x, y, w, h, 6, '#fbfbfb', '#e5e5e5'); }
function settings() {
  g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 30; rr(WIN.x, WIN.y, WIN.w, WIN.h, 8, '#f3f3f3'); g.restore();
  text('Настройки', WIN.x + 50, WIN.y + 24, 14, '#333'); text('←', WIN.x + 20, WIN.y + 24, 16, '#777');
  rr(WIN.x + WIN.w / 2 - 230, WIN.y + 8, 460, 32, 16, '#fff', '#e1e1e1'); text('⌕  Найти параметр', WIN.x + WIN.w / 2 - 212, WIN.y + 24, 15, '#666');
  text('—      ☐      ✕', WIN.x + WIN.w - 70, WIN.y + 22, 14, '#444', 400, 'center');
  rr(WIN.x + 18, WIN.y + 64, 64, 64, 32, '#d9d9d9'); text('Пользователь', WIN.x + 96, WIN.y + 86, 16, '#1b1b1b', 600);
  text('Локальная учетная запись', WIN.x + 96, WIN.y + 108, 13, '#444');
  SIDE.forEach((s, i) => {
    const y = WIN.y + 164 + i * 40;
    if (i === 2) { rr(WIN.x + 12, y - 17, 290, 34, 5, '#e9e9e9'); rr(WIN.x + 12, y - 9, 3, 18, 2, BLUE); }
    rr(WIN.x + 26, y - 9, 18, 18, 4, ['#e8a33d', '#2f8fd8', '#1d6fd1', '#2fa3e0', '#e06b3c', '#5a6fd6', '#2fb38a', '#3b8de0', '#8a8a8a', '#2879d0', '#7a7a7a', '#2a8fd6'][i]);
    text(s, WIN.x + 58, y, 15, '#1b1b1b');
  });
  text('Bluetooth и устройства', CONTENT_X, WIN.y + 86, 32, '#555', 600);
  g.font = F(32, 600); const w1 = g.measureText(t('Bluetooth и устройства')).width;
  text('›   Устройства', CONTENT_X + w1 + 16, WIN.y + 86, 32, '#1b1b1b', 600);
  const cw = WIN.x + WIN.w - 30 - CONTENT_X;
  card(CONTENT_X, WIN.y + 130, cw, 70); btIcon(CONTENT_X + 30, WIN.y + 165, 20);
  text('Bluetooth', CONTENT_X + 64, WIN.y + 155, 16); text('Обнаруживаемый как "LAPTOP"', CONTENT_X + 64, WIN.y + 177, 13, '#555');
  text('Вкл.', CONTENT_X + cw - 100, WIN.y + 165, 15); rr(CONTENT_X + cw - 64, WIN.y + 154, 44, 22, 11, BLUE);
  g.beginPath(); g.arc(CONTENT_X + cw - 31, WIN.y + 165, 7, 0, 7); g.fillStyle = '#fff'; g.fill();
  card(CONTENT_X, WIN.y + 206, cw, 70); text('Подключить новое устройство к "LAPTOP"', CONTENT_X + 18, WIN.y + 241, 16);
  rr(ADD_BTN.x, ADD_BTN.y, ADD_BTN.w, ADD_BTN.h, 5, S.hover === 'add' ? '#196ebf' : BLUE);
  text('Добавить устройство', ADD_BTN.x + ADD_BTN.w / 2, ADD_BTN.y + 20, 15, '#fff', 400, 'center');
  text('Ввод', CONTENT_X, WIN.y + 306, 16, '#1b1b1b', 600);
  const rows = [];
  if (S.devStatus) rows.push([S.dev, S.devStatus, 'pad']);
  rows.push(['Беспроводная мышь', '●', 'mouse']);
  let y = WIN.y + 326;
  for (const [n, st, k] of rows) {
    card(CONTENT_X, y, cw, 68);
    // смену статуса геймпада подсвечиваем: рамка акцентного цвета 1.5 с
    if (k === 'pad' && performance.now() - S.statusAt < 1500) rr(CONTENT_X, y, cw, 68, 6, null, BLUE);
    if (k === 'pad') padIcon(CONTENT_X + 30, y + 34, 26); else rr(CONTENT_X + 20, y + 24, 20, 20, 9, null, '#666');
    text(n, CONTENT_X + 64, y + 24, 16);
    text(st, CONTENT_X + 64, y + 46, st === '●' ? 12 : 13, st === '●' ? '#1a8a2e' : '#555');
    text('⌄', CONTENT_X + cw - 30, y + 32, 18, '#555', 400, 'center'); y += 74;
  }
  text('Аудио', CONTENT_X, y + 24, 16, '#1b1b1b', 600); y += 44;
  card(CONTENT_X, y, cw, 68); rr(CONTENT_X + 20, y + 24, 20, 20, 5, null, '#666');
  text('Наушники Bluetooth', CONTENT_X + 64, y + 24, 16); text('Сопряжено', CONTENT_X + 64, y + 46, 13, '#555');
  rr(CONTENT_X + cw - 160, y + 16, 104, 36, 5, '#fff', '#d6d6d6'); text('Подключить', CONTENT_X + cw - 108, y + 34, 14, '#1b1b1b', 400, 'center');
  // «Другие устройства»: сюда Windows кладёт геймпад, подключённый через ресивер 2.4G, —
  // «Xbox360 For Windows» с зелёной точкой (по скриншоту владельца photo_2026-11-02_18-36-20.jpg)
  y += 68;
  text('Другие устройства', CONTENT_X, y + 30, 16, '#1b1b1b', 600); y += 50;
  card(CONTENT_X, y, cw, 68); btIcon(CONTENT_X + 30, y + 34, 18, BLUE);
  text('Bluetooth-адаптер', CONTENT_X + 64, y + 24, 16); text('●', CONTENT_X + 64, y + 46, 12, '#1a8a2e');
  text('⌄', CONTENT_X + cw - 30, y + 32, 18, '#555', 400, 'center'); y += 74;
  OTHER_Y = y;
  if (S.x360) {
    g.globalAlpha = Math.min(1, (performance.now() - S.x360At) / 400);
    card(CONTENT_X, y, cw, 68);
    if (performance.now() - S.x360At < 1800) rr(CONTENT_X, y, cw, 68, 6, null, BLUE);
    padIcon(CONTENT_X + 30, y + 34, 26); text(S.otherName, CONTENT_X + 64, y + 24, 16);
    text('●', CONTENT_X + 64, y + 46, 12, '#1a8a2e'); text('⌄', CONTENT_X + cw - 30, y + 32, 18, '#555', 400, 'center');
    g.globalAlpha = 1;
  }
}
let OTHER_Y = 0;                                  // верх карточки «Xbox360 For Windows» — для камеры
const DLG = { w: 560, h: 650 }; DLG.x = W / 2 - DLG.w / 2 + 40; DLG.y = WIN.y + 100;
const OPT_BT = { x: DLG.x + 1, y: DLG.y + 152, w: DLG.w - 2, h: 76 };
const ROW_DEV = { x: DLG.x + 10, y: DLG.y + 176, w: DLG.w - 20, h: 60 };
const BTN = { x: DLG.x + DLG.w - 186, y: DLG.y + DLG.h - 60, w: 166, h: 38 };
function dialog() {
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 30; rr(DLG.x, DLG.y, DLG.w, DLG.h, 8, '#fff'); g.restore();
  g.save(); g.beginPath(); g.roundRect(DLG.x, DLG.y, DLG.w, 32, [8, 8, 0, 0]); g.fillStyle = '#000'; g.fill(); g.restore();
  text('Добавить устройство', DLG.x + 14, DLG.y + 16, 13, '#fff'); text('✕', DLG.x + DLG.w - 24, DLG.y + 16, 14, '#fff', 400, 'center');
  const v = S.view;
  if (v === 'type') {
    text('Добавить устройство', DLG.x + 14, DLG.y + 72, 30, '#1b1b1b', 600);
    text('Выберите тип устройства, которое нужно добавить.', DLG.x + 14, DLG.y + 116, 14, '#333');
    if (S.hover === 'bt') rr(OPT_BT.x, OPT_BT.y, OPT_BT.w, OPT_BT.h, 2, '#f5f5f5', '#1b1b1b');
    const opts = [['bt', 'Bluetooth', 'Звуковые устройства, мыши, клавиатуры, телефоны, ручки, контроллеры и прочее'],
      ['disp', 'Беспроводной дисплей или док-станция', 'Беспроводные мониторы, телевизоры и компьютеры (Miracast)'],
      ['plus', 'Все остальное', 'Контроллеры Xbox с беспроводным адаптером Xbox, DLNA и другие']];
    opts.forEach(([k, a, b], i) => {
      const y = OPT_BT.y + i * 84;
      if (k === 'bt') btIcon(DLG.x + 22, y + 30, 14); else text(k === 'disp' ? '▭' : '+', DLG.x + 22, y + 30, 18, '#333', 400, 'center');
      text(a, DLG.x + 50, y + 28, 15); text(b, DLG.x + 50, y + 50, 12, '#333', 600);
    });
    rr(BTN.x, BTN.y, BTN.w, BTN.h, 5, '#fbfbfb', '#d6d6d6'); text('Отмена', BTN.x + BTN.w / 2, BTN.y + 19, 14, '#1b1b1b', 400, 'center');
    return;
  }
  if (v === 'scan' || v === 'connecting') {
    // бегущие точки прогресса под заголовком окна
    const t = performance.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const u = ((t * 0.55 - i * 0.07) % 1 + 1) % 1, x = DLG.x + 40 + (DLG.w - 80) * (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
      g.beginPath(); g.arc(x, DLG.y + 44, 2.6, 0, 7); g.fillStyle = BLUE; g.fill();
    }
    text('Добавить устройство', DLG.x + 14, DLG.y + 76, 30, '#1b1b1b', 600);
    text('Убедитесь, что ваше устройство включено и доступно для обнаружения.', DLG.x + 14, DLG.y + 116, 14, '#333');
    text('Выберите устройство ниже, чтобы подключиться.', DLG.x + 14, DLG.y + 136, 14, '#333');
    if (S.found) {
      g.globalAlpha = Math.min(1, (performance.now() - S.foundAt) / 400);
      if (S.hover === 'dev') rr(ROW_DEV.x, ROW_DEV.y, ROW_DEV.w, ROW_DEV.h, 4, '#f0f0f0');
      padIcon(DLG.x + 30, ROW_DEV.y + 30, 24); text(S.dev, DLG.x + 60, ROW_DEV.y + 20, 15);
      text(v === 'connecting' ? 'Подключение...' : 'Ввод', DLG.x + 60, ROW_DEV.y + 42, 12, '#555');
      g.globalAlpha = 1;
    }
    text('Показать все устройства', DLG.x + 14, DLG.y + 270, 14, '#1b1b1b');
    rr(BTN.x, BTN.y, BTN.w, BTN.h, 5, '#fbfbfb', '#d6d6d6'); text('Отмена', BTN.x + BTN.w / 2, BTN.y + 19, 14, '#1b1b1b', 400, 'center');
    return;
  }
  if (v === 'done') {
    text('Ваше устройство готово к', DLG.x + 14, DLG.y + 74, 30, '#1b1b1b', 600);
    text('использованию!', DLG.x + 14, DLG.y + 114, 30, '#1b1b1b', 600);
    padIcon(DLG.x + 30, ROW_DEV.y + 30, 24); text(S.dev, DLG.x + 60, ROW_DEV.y + 20, 15); text('Подключено', DLG.x + 60, ROW_DEV.y + 42, 12, '#555');
    rr(BTN.x, BTN.y, BTN.w, BTN.h, 5, S.hover === 'ok' ? '#f0f0f0' : '#fbfbfb', '#d6d6d6');
    text('Готово', BTN.x + BTN.w / 2, BTN.y + 19, 14, '#1b1b1b', 400, 'center');
  }
}
function cursor() {
  const { x, y } = S.cur;
  if (S.clickAt && performance.now() - S.clickAt < 400) {
    const k = (performance.now() - S.clickAt) / 400;
    g.beginPath(); g.arc(x, y, 6 + 18 * k, 0, 7); g.strokeStyle = `rgba(0,95,184,${1 - k})`; g.lineWidth = 3; g.stroke();
  }
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 26); g.lineTo(x + 7, y + 20); g.lineTo(x + 12, y + 31); g.lineTo(x + 17, y + 29);
  g.lineTo(x + 12, y + 18); g.lineTo(x + 21, y + 18); g.closePath();
  g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.6; g.stroke();
}
const S = { view: 'desktop', hover: null, cur: { x: W * 0.62, y: H * 0.45 }, clickAt: 0, dev: '', found: false, foundAt: 0,
            devStatus: null, statusAt: 0, menu: false, x360: false, x360At: 0, otherName: 'Xbox360 For Windows' };
const setStatus = st => { S.devStatus = st; S.statusAt = performance.now(); };
function draw() {
  desktop();
  if (S.view !== 'desktop') settings();
  if (['type', 'scan', 'connecting', 'done'].includes(S.view)) dialog();
  if (S.menu) menu();
  cursor();
  tex.needsUpdate = true;
}
draw();

// ---------- сценарий ----------
let run = null;                                  // { stop: bool }
const sleep = ms => new Promise((res, rej) => { const t0 = performance.now();
  const tick = () => { if (!run || run.stop) return rej('stop'); if (performance.now() - t0 >= ms) return res(); requestAnimationFrame(tick); }; tick(); });
const ease = u => u * u * (3 - 2 * u);
async function moveTo(x, y, ms = 900) {
  const a = { ...S.cur }, t0 = performance.now();
  while (true) { const u = Math.min(1, (performance.now() - t0) / ms); S.cur.x = a.x + (x - a.x) * ease(u); S.cur.y = a.y + (y - a.y) * ease(u);
    if (u === 1) break; await sleep(16); }
}
async function click() { S.clickAt = performance.now(); await sleep(250); }
let fly = null;
function flyTo(p, t, ms = 900) { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), at: performance.now(), ms }; }
// точка экрана в мире по координатам canvas (с учётом видимой области)
const onScreen = (x, y) => pointAt(u0 + (x / W) * (u1 - u0), v0 + (1 - y / H) * (v1 - v0));
const trayPt = onScreen(TRAY.bt - 170, H - 190);
const inputPt = onScreen(CONTENT_X + 260, WIN.y + 340);   // карточка геймпада в разделе «Ввод»
const VIEW = {
  // крупно раздел «Ввод»: читается статус под геймпадом
  input: [inputPt.clone().addScaledVector(nrm, 0.13).add(new THREE.Vector3(0, 0.008, 0)).toArray(), inputPt.toArray()],
  // крупно правый нижний угол экрана: значок Bluetooth в трее и его меню
  tray: [trayPt.clone().addScaledVector(nrm, 0.2).add(new THREE.Vector3(0, 0.01, 0)).toArray(), trayPt.toArray()],
  // ноутбук с экраном и геймпад перед ним
  // подобран по кадру: экран ноутбука целиком и геймпад перед ним
  overview: [[0.0, 0.34, 0.5], [0.15, 0.085, -0.13]],
  // экран целиком, с запасом снизу под подпись шага (при 0.36 м она закрывала панель задач)
  screen: [[SCREEN_C.x, SCREEN_C.y + 0.0, SCREEN_C.z + 0.46], [SCREEN_C.x, SCREEN_C.y - 0.035, SCREEN_C.z]],
  switch: [[0.03, -0.06, 0.12], [0, 0.027, 0.029]],      // снизу: переключатель режимов
  home: [[0.0, 0.14, 0.14], [0, 0.05, 0.0]],             // сверху: кнопка Home
};
const capEl = document.getElementById('cap'), stepsEl = document.getElementById('tutsteps');
const STEPS_PAIR = ['Правой кнопкой по значку Bluetooth в трее', '«Добавление устройства Bluetooth»',
  'В «Параметрах» нажмите «Добавить устройство»', 'Выберите «Bluetooth» — начнётся поиск',
  'Переключатель на дне — в нужный режим', 'Зажмите HOME на 3 с — сначала медленное, затем быстрое мигание',
  'В списке появится геймпад — нажмите на него', 'Подключение…', 'Подключено — HOME горит постоянно'];
let curStep = -1, curExtra = '';                    // для перерисовки при смене языка
function step(i, extra = '') {
  curStep = i; curExtra = extra;
  [...stepsEl.children].forEach((li, k) => { li.className = k < i ? 'done' : k === i ? 'cur' : ''; });
  capEl.textContent = `${i + 1}/${STEPS.length}. ${t(STEPS[i])}${t(extra)}`; capEl.style.display = 'block';
}
const STEPS_RECONNECT = ['Геймпад уже сопряжён: в «Параметрах», раздел «Ввод» — «Сопряжено»',
  'Коротко нажмите HOME', 'Индикатор мигает — идёт подключение', 'Через пару секунд горит постоянно',
  'В «Параметрах» под геймпадом — «Подключено»'];
let STEPS = STEPS_PAIR;
const setSteps = list => { STEPS = list; curStep = -1; stepsEl.innerHTML = STEPS.map(s => `<li>${t(s)}</li>`).join(''); };
async function scenario(mode) {
  const dev = DEVICE[mode];
  Object.assign(S, { view: 'desktop', menu: false, hover: null, dev, found: false, devStatus: null });
  G6.reset(); G6.led('off');
  controls.enabled = false; flyTo(...VIEW.tray, 1200); await sleep(1300);
  step(0); await moveTo(TRAY.bt, H - TB.h / 2, 1100); S.hover = 'tray'; await sleep(250); await click(); S.menu = true; S.hover = null;
  step(1); const b = menuBox(); await moveTo(b.x + 150, b.y + 8 + MIH / 2, 800); S.hover = 'menu0'; await sleep(300); await click();
  S.menu = false; S.hover = null; S.view = 'settings'; flyTo(...VIEW.screen, 900);
  step(2); await sleep(700); await moveTo(ADD_BTN.x + ADD_BTN.w / 2, ADD_BTN.y + ADD_BTN.h / 2, 1000); S.hover = 'add'; await sleep(300); await click();
  S.hover = null; S.view = 'type';
  step(3); await sleep(500); await moveTo(OPT_BT.x + 160, OPT_BT.y + 38, 800); S.hover = 'bt'; await sleep(350); await click();
  S.hover = null; S.view = 'scan'; await sleep(1200);
  // переключатель: подсветка подписи текущего режима, затем ручка и подсветка переезжают на нужный
  step(4, ` → ${MODE_HINT[mode]}`); G6.modeHighlight(true); flyTo(...VIEW.switch, 1000); await sleep(1600);
  G6.mode(mode); await sleep(1600); G6.modeHighlight(false);
  // HOME: сначала подлёт к ненажатой кнопке и указатель, потом удержание с отсчётом
  step(5); flyTo(...VIEW.home, 1000); await sleep(1100);
  hint('Зажать HOME на 3 сек.'); await sleep(1500);
  G6.set({ Home: 1 });
  for (const n of [3, 2, 1]) { hint(`Удерживайте HOME… ${n}`, 'медленно мигает — как при кратком нажатии'); await sleep(1000); }
  hint('Режим сопряжения', 'индикатор быстро мигает — можно отпустить'); await sleep(400); G6.set({ Home: 0 });
  await sleep(1500);                                       // видно быстрое мигание (2 раза/с)
  hint(null);
  flyTo(...VIEW.overview, 1100); await sleep(900);
  S.found = true; S.foundAt = performance.now();
  step(6, ` («${dev}»)`); await sleep(1400);            // общий план: Home мигает, геймпад в списке
  flyTo(...VIEW.screen, 1000); await sleep(1000);
  await moveTo(ROW_DEV.x + 200, ROW_DEV.y + 30, 900); S.hover = 'dev'; await sleep(300); await click();
  S.hover = null; S.view = 'connecting';
  step(7); await sleep(2000);
  S.view = 'done'; setStatus('Подключено'); G6.led('on');
  step(8); flyTo(...VIEW.overview, 1100); await sleep(2600);   // окно «готово» и горящий Home вместе
  flyTo(...VIEW.screen, 900); await sleep(900);
  await moveTo(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2, 800); S.hover = 'ok'; await sleep(250); await click();
  S.hover = null; S.view = 'settings'; await sleep(2500);
}
// Повторное подключение к ранее сопряжённому ПК: Windows уже знает геймпад («Сопряжено»)
async function reconnect(mode) {
  const dev = DEVICE[mode];
  Object.assign(S, { view: 'settings', menu: false, hover: null, dev, found: false });
  setStatus('Сопряжено'); S.statusAt = 0;
  G6.reset(); G6.mode(mode); G6.led('off');               // переключатель уже в режиме этого ПК
  controls.enabled = false; flyTo(...VIEW.input, 1200); await sleep(1300);
  step(0, ` («${dev}»)`);
  const row = { x: CONTENT_X + 64, y: WIN.y + 326 + 34 };  // первая карточка раздела «Ввод»
  await moveTo(row.x + 120, row.y + 12, 900); await sleep(1800);
  step(1); flyTo(...VIEW.home, 1000); await sleep(1100);
  hint('Коротко нажать HOME'); await sleep(1400);
  G6.set({ Home: 1 }); await sleep(250); G6.set({ Home: 0 });
  step(2); hint('Подключение…', 'индикатор мигает 1 раз/с');
  flyTo(...VIEW.overview, 1100);
  const t0 = performance.now();
  while (G6.led() !== 'on') { if (performance.now() - t0 > 8000) throw new Error('нет подключения'); await sleep(30); }
  setStatus('Подключено'); hint(null);
  step(3, ` (через ${((performance.now() - t0) / 1000).toFixed(1)} с)`); await sleep(2400);
  step(4); flyTo(...VIEW.input, 1000); await sleep(1000);
  await moveTo(row.x + 120, row.y + 12, 600); await sleep(2800);
}
// Регулировка вибрации: T (узел Btn_Share) держать, правый стик вверх/вниз, отпустить T — сохранено
const STEPS_VIB = ['Геймпад должен быть включён или подключён', 'Зажмите T (Турбо) и удерживайте', 'Правый стик вверх — вибрация сильнее',
  'Правый стик вниз — слабее, до выключения', 'Отпустите T — настройка сохранена'];
async function vibration() {
  const tObj = G6.three.nodes.Btn_Share.obj, stick = G6.three.nodes.Stick_R.obj;
  G6.reset(); G6.vibration(1);
  controls.enabled = false; flyTo([0.02, 0.16, 0.17], [0.012, 0.045, 0.02], 1200); await sleep(1300);
  step(0);
  if (G6.led() === 'off' || G6.led() === 'charge') {          // выключен — включаем коротким HOME
    hint('Коротко нажать HOME', 'геймпад включится'); await sleep(1300);
    G6.set({ Home: 1 }); await sleep(250); G6.set({ Home: 0 });
    hint('Геймпад включён', 'индикатор мигает — ищет устройство'); await sleep(1600);
  } else { hint('Геймпад включён', 'индикатор горит или мигает'); await sleep(1500); }
  step(1); hint('Зажать T и удерживать', 'кнопка «Турбо»', tObj, 0.007); await sleep(1500);
  G6.set({ Share: 1 }); hint('T удерживается', '', tObj, 0.007); await sleep(1000);
  const flick = async (dir, label) => {          // один отклон стика — одна ступень
    // уровень — на шкале сверху; в подписи у стика числа нет, чтобы она не отставала от шкалы
    hint(label, '', stick, 0.024);
    G6.set({ ry: dir }); await sleep(380); G6.set({ ry: 0 }); await sleep(1020);
  };
  step(2); for (let i = 0; i < 2; i++) await flick(-1, 'Правый стик ↑ — сильнее');   // 1 -> 3
  step(3); for (let i = 0; i < 3; i++) await flick(1, 'Правый стик ↓ — слабее');    // 3 -> выкл.
  step(2, ' — включаем снова'); for (let i = 0; i < 2; i++) await flick(-1, 'Правый стик ↑ — сильнее');   // выкл. -> 2
  step(4); hint('Отпустить T', '', tObj, 0.007); await sleep(1000);
  G6.set({ Share: 0 }); hint(`Сохранено: ${G6.vibration()} из 3`, '', tObj, 0.007); await sleep(2600);
  hint(null);
}
// Настройка Турбо — по проверке владельца на изделии: зажать кнопку, коротко T — турбо назначено;
// T + левый стик — скорость, отпустить T — сохранено; держа кнопку, дважды быстро T — турбо снято.
const STEPS_TURBO = ['Геймпад должен быть включён или подключён', 'Зажмите A и удерживайте',
  'Коротко нажмите T — на A назначено турбо', 'Держите A: в игру идут повторные нажатия',
  'Скорость: зажмите T и левым стиком ↑/↓ (8 / 15 / 25 нажатий/с)', 'Отпустите T — скорость сохранена',
  'AUTO: держите A (на ней TURBO) и коротко нажмите T', 'Отпустите A — кнопка нажимается сама',
  'Снять турбо: держите A и дважды быстро нажмите T', 'Отпустите A — кнопка снова обычная'];
async function turboTutorial() {
  const N = G6.three.nodes, aObj = N.Btn_A.obj, tObj = N.Btn_Share.obj, ls = N.Stick_L.obj;
  G6.reset(); G6.turbo('A', 'off');
  controls.enabled = false; flyTo([0.02, 0.16, 0.16], [0.012, 0.045, 0.012], 1200); await sleep(1300);
  step(0);
  if (G6.led() === 'off' || G6.led() === 'charge') {
    hint('Коротко нажать HOME', 'геймпад включится'); await sleep(1300);
    G6.set({ Home: 1 }); await sleep(250); G6.set({ Home: 0 }); await sleep(1200);
  }
  const tapT = async () => { G6.set({ Share: 1 }); await sleep(160); G6.set({ Share: 0 }); };
  step(1); hint('Зажать A и удерживать', '', aObj, 0.007); await sleep(900); G6.set({ A: 1 }); await sleep(900);
  step(2); hint('Коротко нажать T', 'A не отпускаем', tObj, 0.007); await sleep(900); await tapT(); await sleep(600);
  step(3); hint('A держим — повторы', 'смотрите сигнал справа сверху', aObj, 0.007); await sleep(2600);
  G6.set({ A: 0 }); hint('Отпустили — повторы прекратились', '', aObj, 0.007); await sleep(1500);
  step(4); hint('Зажать T', '', tObj, 0.007); await sleep(800); G6.set({ Share: 1 }); await sleep(500);
  for (const [d, lbl] of [[-1, 'Левый стик ↑ — быстрее'], [1, 'Левый стик ↓ — медленнее'], [1, 'Левый стик ↓ — медленнее'], [-1, 'Левый стик ↑ — быстрее']]) {
    hint(lbl, '', ls, 0.024); G6.set({ ly: d }); await sleep(350); G6.set({ ly: 0 }); await sleep(1200);
  }
  step(5); hint('Отпустить T', '', tObj, 0.007); await sleep(700); G6.set({ Share: 0 }); await sleep(1400);
  hint('Держать A', `повторы ${G6.turboRate()} нажатий/с`, aObj, 0.007); G6.set({ A: 1 }); await sleep(2000);
  step(6); hint('Коротко нажать T', 'A не отпускаем', tObj, 0.007); await sleep(900); await tapT(); await sleep(700);
  step(7); G6.set({ A: 0 }); hint('A отпущена', 'повторы идут сами — AUTO', aObj, 0.007); await sleep(2800);
  step(8); hint('Зажать A и дважды быстро T', '', tObj, 0.007); await sleep(900); G6.set({ A: 1 }); await sleep(500);
  await tapT(); await sleep(150); await tapT(); await sleep(700);
  step(9); G6.set({ A: 0 }); hint('Отпустить A', 'турбо снято', aObj, 0.007); await sleep(1200);
  hint('Держать A', 'обычный режим — одно непрерывное нажатие', aObj, 0.007); G6.set({ A: 1 }); await sleep(1800); G6.set({ A: 0 });
  hint('Другие кнопки — так же', 'B, X, Y, LB, RB, LT, RT', aObj, 0.007); await sleep(2200); hint(null);
}
// Подключение через ресивер 2.4G: ресивер в USB ПК -> переключатель 2.4G -> коротко HOME -> почти сразу
// HOME горит голубым, ресивер красным; в «Параметрах» в «Другие устройства» — «Xbox360 For Windows».
// Кабель в ПК вместе с ресивером запрещён (конфликт подключений) — его сначала вынимаем.
const STEPS_RX = ['Вставьте ресивер в USB-порт ПК — он мигает красным', 'Переключатель на дне — в 2.4G',
  'Коротко нажмите HOME', 'Почти сразу: HOME горит голубым, ресивер — красным',
  'В «Параметрах», «Другие устройства» — «Xbox360 For Windows»'];
async function receiverTutorial() {
  Object.assign(S, { view: 'settings', menu: false, hover: null, found: false, devStatus: null, x360: false,
    otherName: 'Xbox360 For Windows' });
  G6.reset(); G6.led('off');
  controls.enabled = false; flyTo(...VIEW.overview, 1200); await sleep(1300);
  if (G6.cable() === 'pc') { capEl.textContent = t('Кабель в ПК вместе с ресивером нельзя — вынимаем кабель'); capEl.style.display = 'block';
    G6.cable(null); await sleep(1800); }
  if (G6.receiver() !== 'out') { G6.receiver(false); await sleep(1700); }
  step(0); await sleep(600); G6.receiver(true);
  while (G6.receiver() === 'out') await sleep(30);
  await sleep(1800);                                        // видно мигание ресивера, 1 раз/с
  step(1); G6.modeHighlight(true); flyTo(...VIEW.switch, 1000); await sleep(1500);
  G6.mode('2.4G'); await sleep(1600); G6.modeHighlight(false);
  step(2); flyTo(...VIEW.home, 1000); await sleep(1100);
  hint('Коротко нажать HOME'); await sleep(1300);
  G6.set({ Home: 1 }); await sleep(250); G6.set({ Home: 0 });
  flyTo(...VIEW.overview, 900);
  const t0 = performance.now();
  while (G6.led() !== 'on') { if (performance.now() - t0 > 5000) throw new Error('нет сопряжения'); await sleep(20); }
  hint(null); step(3, ` (за ${((performance.now() - t0) / 1000).toFixed(1)} с)`); await sleep(2800);
  S.x360 = true; S.x360At = performance.now();
  step(4);
  const p = onScreen(CONTENT_X + 260, OTHER_Y + 34);
  flyTo(p.clone().addScaledVector(nrm, 0.13).add(new THREE.Vector3(0, 0.008, 0)).toArray(), p.toArray(), 1100);
  await sleep(3800);
}
// По кабелю к ПК: имя в Windows зависит от режима переключателя (так на изделии)
const WIRED_NAME = { X: 'Xbox360 For Windows', '2.4G': 'Xbox360 For Windows', V3: 'Android GamePad',
  M: 'Wireless Controller', S: 'Pro Controller' };
const STEPS_WIRED = ['Переключатель на дне — в нужный режим', 'Кабель: USB-A в ПК, Type-C в геймпад',
  'HOME мигает 1 раз в 3 с — питание от ПК', 'В «Параметрах», «Другие устройства» — геймпад'];
async function wiredTutorial(mode) {
  const name = WIRED_NAME[mode];
  Object.assign(S, { view: 'settings', menu: false, hover: null, found: false, devStatus: null, x360: false, otherName: name });
  G6.reset(); G6.led('off');
  controls.enabled = false; flyTo(...VIEW.overview, 1200); await sleep(1300);
  if (G6.receiver() !== 'out') {                             // ресивер в ПК вместе с кабелем — конфликт
    capEl.textContent = t('Ресивер в ПК вместе с кабелем нельзя — вынимаем ресивер'); capEl.style.display = 'block';
    G6.receiver(false); await sleep(1800);
  }
  if (G6.cable()) { G6.cable(null); await sleep(1300); }
  step(0, ` → ${mode}`); G6.modeHighlight(true); flyTo(...VIEW.switch, 1000); await sleep(1500);
  G6.mode(mode); await sleep(1600); G6.modeHighlight(false);
  step(1); flyTo(...VIEW.overview, 1000); await sleep(1100);
  G6.cable('pc');
  while (!G6.cable()) await sleep(30);                         // штекеры дошли до упора
  step(2); await sleep(1500);
  flyTo(...VIEW.home, 900); await sleep(2600);                 // видно мигание HOME 1 раз в 3 с
  S.x360 = true; S.x360At = performance.now();
  step(3, ` («${name}»)`);
  const p = onScreen(CONTENT_X + 260, OTHER_Y + 34);
  flyTo(p.clone().addScaledVector(nrm, 0.13).add(new THREE.Vector3(0, 0.008, 0)).toArray(), p.toArray(), 1100);
  await sleep(3800);
}
// Макросы (так на изделии): зажать M1 -> зажать SELECT (View) до быстрого белого мигания -> отпустить оба ->
// кнопки или сочетания (A, B, X + Y) -> M1 сохраняет; M1 — выполнить; сброс — вход так же, отпустить, сразу M1.
// Темп поэтапный (отзыв владельца: в первой версии всё шло слишком быстро): каждый этап — пролёт камеры,
// пауза, указатель, время прочитать, действие, время увидеть результат. Первое выполнение — замедленно ×5.
const STEPS_MACRO = ['Геймпад должен быть включён или подключён', 'Зажмите M1 на обратной стороне',
  'Не отпуская M1, зажмите SELECT', 'Держите, пока HOME не замигает быстро белым', 'Отпустите M1 и SELECT',
  'Нажимайте кнопки или сочетания: A → B → X + Y вместе', 'Ещё раз M1 — сохранено',
  'Коротко M1 — макрос выполняется', 'Сброс: M1 + SELECT до быстрого мигания, отпустить, ещё раз M1',
  'M1 больше ничего не выполняет'];
const FLY_MS = 1300, SETTLE_MS = 500, READ_MS = 1800, SEE_MS = 2000;
async function macroTutorial() {
  const N = G6.three.nodes, view = N.Btn_View.obj, m1 = N.M1.obj;
  const TOP = [[0.0, 0.15, 0.15], [0.0, 0.045, 0.0]], ABXY = [[0.02, 0.16, 0.16], [0.012, 0.045, 0.012]];
  const tap = async (k, ms = 250) => { G6.set({ [k]: 1 }); await sleep(ms); G6.set({ [k]: 0 }); };
  const until = async st => { while (G6.macroState() !== st) await sleep(20); };
  const fly = async v => { flyTo(...v, FLY_MS); await sleep(FLY_MS + SETTLE_MS); };
  // указатель -> время прочитать -> действие -> время увидеть результат
  const beat = async (main, sub, obj, lift, act, see = SEE_MS) => {
    hint(main, sub, obj, lift); await sleep(READ_MS); if (act) await act(); await sleep(see);
  };
  G6.reset(); G6.macro('M1', []); G6.macroSlow(1);
  controls.enabled = false; await fly(TOP);
  step(0);
  if (G6.led() === 'off' || G6.led() === 'charge') {
    await beat('Коротко нажать HOME', 'геймпад включится', null, 0, () => tap('Home'), 2600);
  }
  step(1); hint(null); await fly(VIEW.switch);
  await beat('Зажать M1', 'и держать', m1, -0.004, () => G6.set({ M1: 1 }), 1200);
  step(2); hint(null); await fly(TOP);
  await beat('Зажать SELECT', 'M1 не отпускаем', view, 0.006, () => G6.set({ View: 1 }), 0);
  step(3); hint('Держать оба…', 'ждём быстрого белого мигания'); await until('release');
  hint('HOME быстро мигает белым', 'режим записи M1'); await sleep(SEE_MS + 500);
  step(4); await beat('Отпустить M1 и SELECT', 'теперь можно назначать кнопки', null, 0, () => G6.set({ M1: 0, View: 0 }));
  step(5); hint(null); await fly(ABXY);
  for (const k of ['A', 'B']) await beat(`Нажать ${k}`, `шаг ${k === 'A' ? 1 : 2} записан — смотрите строку сверху`, N['Btn_' + k].obj, 0.007, () => tap(k), 1400);
  await beat('Нажать X + Y вместе', 'сочетание — один шаг', N.Btn_Y.obj, 0.007, async () => {
    G6.set({ X: 1, Y: 1 }); await sleep(300); G6.set({ X: 0, Y: 0 });
  }, 1400);
  step(6); hint(null); await fly(VIEW.switch);
  await beat('Нажать M1 ещё раз', 'сохранить', m1, -0.004, () => tap('M1'), 600);
  hint(null); await fly(TOP); hint('HOME горит постоянно', 'макрос A → B → X + Y сохранён'); await sleep(SEE_MS + 500);
  step(7); hint(null); await fly(ABXY);
  G6.macroSlow(5);
  await beat('Коротко M1', 'замедленно ×5: шаги по очереди — A, B, X + Y', m1, 0, () => tap('M1', 150), 3600);
  G6.macroSlow(1);
  await beat('Ещё раз M1', 'на реальной скорости — 0.6 с', m1, 0, () => tap('M1', 150), SEE_MS);
  step(8); hint(null); await fly(VIEW.switch);
  // так на изделии: нажатое M1 сначала выполняет сохранённый макрос (проверено владельцем)
  await beat('Сброс: зажать M1', 'и держать; макрос сработает — так и должно быть', m1, -0.004, () => G6.set({ M1: 1 }), 1400);
  hint(null); await fly(TOP);
  await beat('Зажать SELECT', 'держать до быстрого мигания', view, 0.006, () => G6.set({ View: 1 }), 0);
  hint('Держать оба…', 'ждём быстрого белого мигания'); await until('release'); await sleep(SEE_MS);
  await beat('Отпустить оба', 'ничего не нажимаем', null, 0, () => G6.set({ M1: 0, View: 0 }), 1200);
  hint(null); await fly(VIEW.switch);
  await beat('Ещё раз M1', 'сброс', m1, -0.004, () => tap('M1'), 600);
  hint(null); await fly(TOP); hint('HOME горит постоянно', 'макрос M1 сброшен'); await sleep(SEE_MS);
  step(9); hint(null); await fly(ABXY);
  await beat('Коротко M1', 'макроса нет — ничего не происходит', m1, 0, () => tap('M1', 150), 2400);
  hint(null);
}
// Повторное подключение через ресивер: ресивер уже в ПК и раньше сопрягался с геймпадом, переключатель
// в 2.4G, геймпад выключен — ресивер мигает красным; коротко HOME — почти сразу связь (как и первое
// сопряжение по ресиверу: на изделии 2.4G + короткий HOME соединяются почти мгновенно).
const STEPS_RX2 = ['Ресивер уже в USB-порту ПК, переключатель — в 2.4G', 'Геймпад выключен — ресивер мигает красным, ждёт',
  'Коротко нажмите HOME', 'Почти сразу: HOME горит голубым, ресивер — красным',
  '«Другие устройства» — «Xbox360 For Windows» снова в списке'];
async function rxReconnect() {
  Object.assign(S, { view: 'settings', menu: false, hover: null, found: false, devStatus: null, x360: false,
    otherName: 'Xbox360 For Windows' });
  G6.reset(); G6.led('off');
  controls.enabled = false; flyTo(...VIEW.overview, 1200);
  // исходное положение готовим до первого шага: кабель из ПК (конфликт), ресивер в порт, режим 2.4G
  if (G6.cable() === 'pc') { G6.cable(null); await sleep(1300); }
  if (G6.receiver() === 'out') { G6.receiver(true); while (G6.receiver() === 'out') await sleep(30); }
  G6.mode('2.4G'); G6.led('off'); await sleep(1300);
  step(0); await sleep(2200);
  step(1); await sleep(2400);                                  // видно мигание ресивера, 1 раз/с
  step(2); flyTo(...VIEW.home, 1000); await sleep(1100);
  hint('Коротко нажать HOME'); await sleep(1300);
  G6.set({ Home: 1 }); await sleep(250); G6.set({ Home: 0 });
  flyTo(...VIEW.overview, 900);
  const t0 = performance.now();
  while (G6.led() !== 'on') { if (performance.now() - t0 > 5000) throw new Error('нет сопряжения'); await sleep(20); }
  hint(null); step(3, ` (за ${((performance.now() - t0) / 1000).toFixed(1)} с)`); await sleep(2800);
  S.x360 = true; S.x360At = performance.now();
  step(4);
  const p = onScreen(CONTENT_X + 260, OTHER_Y + 34);
  flyTo(p.clone().addScaledVector(nrm, 0.13).add(new THREE.Vector3(0, 0.008, 0)).toArray(), p.toArray(), 1100);
  await sleep(3800);
}

// ---------- меню ----------
// Разделы: Bluetooth (режимы X / V3 / M / S), ресивер 2.4G (режим всегда 2.4G), USB (2.4G / X / V3 / M / S),
// настройки геймпада. Платформы — пока только Windows, остальные помечены «скоро».
const TUTS = {
  pair: [scenario, STEPS_PAIR], reconnect: [reconnect, STEPS_RECONNECT], receiver: [receiverTutorial, STEPS_RX],
  rxreconnect: [rxReconnect, STEPS_RX2], wired: [wiredTutorial, STEPS_WIRED], vibration: [vibration, STEPS_VIB],
  turbo: [turboTutorial, STEPS_TURBO], macro: [macroTutorial, STEPS_MACRO],
};
const panel = document.getElementById('panel');
const tutBtns = [...panel.querySelectorAll('[data-tut]')];
const chosen = { bt: 'X', usb: 'X' };
const modeFor = kind => (kind === 'pair' || kind === 'reconnect' ? chosen.bt : kind === 'wired' ? chosen.usb
  : kind === 'receiver' || kind === 'rxreconnect' ? '2.4G' : G6.mode());
function showDevices() {
  panel.querySelector('[data-dev="bt"]').textContent = t(`Имя в Windows: ${DEVICE[chosen.bt]}`);
  panel.querySelector('[data-dev="usb"]').textContent = t(`Имя в Windows: ${WIRED_NAME[chosen.usb]}`);
  panel.querySelector('[data-dev="rx"]').textContent = t('Режим 2.4G · имя в Windows: Xbox360 For Windows');
  for (const el of panel.querySelectorAll('[data-modes]'))
    for (const b of el.children) b.classList.toggle('on', b.textContent === chosen[el.dataset.modes]);
}
for (const el of panel.querySelectorAll('[data-modes]')) {
  el.innerHTML = el.dataset.list.split(' ').map(m => `<button>${m}</button>`).join('');
  el.addEventListener('click', e => { if (e.target.tagName === 'BUTTON' && !run) { chosen[el.dataset.modes] = e.target.textContent; showDevices(); } });
}
const platTpl = document.getElementById('plat-tpl');
for (const slot of panel.querySelectorAll('[data-plat-slot]')) slot.replaceWith(platTpl.content.cloneNode(true));
// раскрыт один раздел; «Вручную» открывается независимо
const secs = [...panel.querySelectorAll('details.sec')].filter(d => d.dataset.sec !== 'manual');
for (const d of secs) d.addEventListener('toggle', () => { if (d.open) for (const o of secs) if (o !== d) o.open = false; });
applyStatic(panel); showDevices();
const label = (b, ru) => { const sp = b.querySelector('[data-i18n]'); sp.dataset.ru = ru; sp.textContent = t(ru); };

async function start(kind = 'pair', mode = modeFor(kind)) {
  if (run) { run.stop = true; return; }
  if ((kind === 'pair' || kind === 'reconnect') && !DEVICE[mode]) {     // 2.4G — не Bluetooth
    capEl.textContent = t('2.4G — не Bluetooth: выберите X, V3, M или S либо инструкцию «Через ресивер 2.4G»');
    capEl.style.display = 'block'; setTimeout(() => { if (!run) capEl.style.display = 'none'; }, 3500); return;
  }
  G6.demo(false);
  const [fn, steps] = TUTS[kind], b = tutBtns.find(o => o.dataset.tut === kind);
  b.closest('details').open = true;              // раскрыт раздел этой инструкции, остальные свернутся
  setSteps(steps);
  run = { stop: false }; b.dataset.label = b.querySelector('[data-i18n]').dataset.ru; label(b, '■ Стоп'); b.classList.add('on');
  for (const o of tutBtns) if (o !== b) o.disabled = true;
  try { await fn(mode); } catch (e) { if (e !== 'stop') console.error(e); G6.set({ Home: 0 }); }
  hint(null); G6.modeHighlight(false);
  run = null; fly = null; controls.enabled = true; label(b, b.dataset.label); b.classList.remove('on');
  for (const o of tutBtns) o.disabled = false; G6.set({ Share: 0, ry: 0, ly: 0, A: 0, View: 0, M1: 0 }); G6.macroSlow(1);
  // через 4 с после конца — плавно в «Сбросить вид»; если камеру за это время тронули — не трогаем
  const myEnd = ++endSeq; userMoved = false;
  setTimeout(() => {
    if (run || myEnd !== endSeq) return;
    capEl.style.display = 'none'; curStep = -1;
    [...stepsEl.children].forEach(li => (li.className = ''));
    if (!userMoved) { const h = G6.homeView(); flyTo(h.pos.toArray(), h.target.toArray(), 1400); }
    // кабель вставлен и HOME мигает 1 раз в 3 с — отдельно показываем, что параллельно идёт зарядка
    setTimeout(() => {
      if (run || myEnd !== endSeq || !G6.cable() || G6.led() !== 'charge') return;
      hint('HOME мигает 1 раз в 3 с', G6.cable() === 'pc' ? 'параллельно идёт зарядка от ПК' : 'идёт зарядка');
      setTimeout(() => { if (!run && myEnd === endSeq) hint(null); }, 5000);
    }, 1500);
  }, 4000);
}
let endSeq = 0, userMoved = false;
controls.addEventListener('start', () => { userMoved = true; });   // пользователь сам вращает камеру
for (const b of tutBtns) b.addEventListener('click', () => start(b.dataset.tut));
// смена языка: список шагов, подпись текущего шага, указатель и экран ноутбука — сразу
onLang(() => {
  if (stepsEl.children.length) stepsEl.innerHTML = STEPS.map(s => `<li>${t(s)}</li>`).join('');
  if (curStep >= 0) { const c = curStep; step(c, curExtra); }
  if (hintEl.style.display !== 'none') hint(hintMain, hintSub, hintObj, hintLift);
  showDevices(); draw();
});

// Указатель на HOME: стрелка и подпись, привязанные к кнопке на экране (проекция каждый кадр)
const hintEl = document.createElement('div');
hintEl.style.cssText = 'position:fixed;display:none;transform:translate(-50%,-100%);pointer-events:none;text-align:center;' +
  'font:600 15px "Segoe UI",system-ui,sans-serif;color:#fff;';
document.body.appendChild(hintEl);
let hintObj = null, hintLift = 0.008, hintMain = '', hintSub = '';
function hint(main, sub = '', obj = null, lift = 0.008) {
  if (!main) { hintEl.style.display = 'none'; return; }
  hintObj = obj; hintLift = lift; hintMain = main; hintSub = sub;
  hintEl.innerHTML = `<div style="background:rgba(20,20,22,.88);padding:8px 14px;border-radius:10px;white-space:nowrap">${t(main)}` +
    (sub ? `<div style="font-weight:400;font-size:12.5px;opacity:.85;margin-top:2px">${t(sub)}</div>` : '') +
    '</div><div style="font-size:30px;line-height:30px;color:#1e88ff;text-shadow:0 1px 3px rgba(0,0,0,.4)">▼</div>';
  hintEl.style.display = 'block';
}
const homeObj = G6.three.nodes.Btn_Home.obj, hp = new THREE.Vector3();
function placeHint() {
  if (hintEl.style.display === 'none') return;
  (hintObj ?? homeObj).getWorldPosition(hp); hp.y += hintLift;   // над кнопкой (по умолчанию — HOME)
  hp.project(camera);
  const r = G6.three.renderer.domElement.getBoundingClientRect();
  const x = r.left + (hp.x + 1) / 2 * r.width;
  hintEl.style.left = x + 'px'; hintEl.style.top = (r.top + (1 - hp.y) / 2 * r.height) + 'px';
  // плашка не выходит за край окна (у M1 сзади она обрезалась справа), стрелка остаётся над кнопкой
  const plate = hintEl.firstChild, w = plate.offsetWidth / 2, pad = 8;
  const dx = Math.max(0, pad - (x - w)) + Math.min(0, innerWidth - pad - (x + w));
  plate.style.transform = dx ? `translateX(${dx}px)` : '';
}
let lastDraw = 0;
(function loop() {
  if (fly) {
    const u = ease(Math.min(1, (performance.now() - fly.at) / fly.ms));
    camera.position.lerpVectors(fly.p0, fly.p1, u); controls.target.lerpVectors(fly.t0, fly.t1, u); controls.update();
    if (u === 1) fly = null;
  }
  // Текстура экрана 1400 × 1030 — 5.8 МБ на загрузку в видеокарту. Перерисовка на каждом кадре
  // роняла рендер до 32 кадров/с и подвешивала показ страницы; теперь — только во время инструкции
  // и не чаще 30 раз в секунду, а в покое — раз в 10 с (часы на панели задач).
  placeHint();
  const now = performance.now();
  if (now - lastDraw > (run ? 33 : 10000)) { draw(); lastDraw = now; }
  requestAnimationFrame(loop);
})();
G6.tutorial = { start, devices: DEVICE, screenSize: [W, H] };   // start('pair' | 'reconnect' | 'receiver' | 'rxreconnect' | 'wired' | 'vibration' | 'turbo' | 'macro', mode?)
