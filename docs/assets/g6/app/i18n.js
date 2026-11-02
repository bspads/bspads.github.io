// Два языка интерфейса: русский (исходный — строки в коде остаются русскими) и английский — словарь ru → en.
// Переводим в местах вывода (подсказка, подпись шага, экран ноутбука, строки состояния), а не там, где
// строка объявлена: так переключение языка действует сразу, в том числе посреди инструкции и в том, что
// перерисовывается каждый кадр. Строки с подстановками («Нажать A», «M1: сохранено») ловятся шаблонами:
// ключ с {} превращается в регулярное выражение, подставленные куски тоже переводятся (цвет, режим).
const EN = {
  // ---- панель ----
  'BSP G6 — инструкции': 'BSP G6 — guides',
  'Загрузка модели…': 'Loading model…',
  'Расцветка': 'Colour',
  'Чёрный': 'Black', 'Серый': 'Gray', 'Белый': 'White', 'Дракон (белый)': 'Dragon (white)', 'Дракон (чёрный)': 'Dragon (black)',
  '▶ Демо': '▶ Demo', '■ Стоп': '■ Stop', 'Сбросить вид': 'Reset view',
  'Геймпад красиво вращается, кнопки нажимаются, стики крутятся': 'The gamepad spins, buttons press, sticks rotate',
  '1. Bluetooth': '1. Bluetooth', '2. Ресивер 2.4G': '2. 2.4G receiver', '3. USB-подключение': '3. USB connection',
  '4. Настройки геймпада': '4. Gamepad settings',
  'Платформа': 'Platform', 'Скоро': 'Coming soon', 'Режим переключателя': 'Switch mode',
  'Имя в Windows: {}': 'Name in Windows: {}',
  'Режим 2.4G · имя в Windows: {}': '2.4G mode · name in Windows: {}',
  '▶ Подключение': '▶ Connect', '▶ Повторное подключение': '▶ Reconnect',
  '▶ Режим Турбо': '▶ Turbo mode', '▶ Настройка вибрации': '▶ Vibration', '▶ Макросы': '▶ Macros',
  'Гироскоп': 'Gyroscope', 'Сброс калибровки стиков': 'Stick calibration reset', 'скоро': 'soon',
  'Первое сопряжение: зажать HOME 3 с': 'First pairing: hold HOME for 3 s',
  'Геймпад уже сопряжён с этим ПК': 'The gamepad is already paired with this PC',
  'Ресивер в USB ПК, переключатель 2.4G, коротко HOME': 'Receiver in a PC USB port, switch to 2.4G, short HOME',
  'Ресивер уже в ПК и сопряжён: коротко HOME': 'Receiver already in the PC and paired: short HOME',
  'Кабель Type-C → USB-A в ПК, имя в Windows по режиму': 'Type-C → USB-A cable to the PC, Windows name depends on mode',
  'Зажать кнопку + коротко T; T + левый стик — скорость; кнопка + 2× T — снять':
    'Hold a button + short T; T + left stick — speed; button + 2× T — remove',
  'T + правый стик': 'T + right stick',
  'M1 + SELECT до быстрого мигания — запись, M1 — сохранить; M1 — выполнить':
    'M1 + SELECT until fast blinking — record, M1 — save; M1 — play',
  'Вручную': 'Manual control',
  'Кабель в ПК': 'Cable to PC', 'Кабель в зарядку': 'Cable to charger', 'Ресивер в USB': 'Receiver to USB',
  'Кабель геймпада в USB-зарядку / вынуть (клавиша J)': 'Gamepad cable to a USB charger / unplug (key J)',
  'Переключатель режимов на дне (клавиша M)': 'Mode switch on the bottom (key M)',
  'Home: коротко — подключение, удержание 3 с — сопряжение (клавиша Space)': 'Home: short — connect, hold 3 s — pairing (Space key)',
  'Для сопряжения: переключатель в 2.4G, затем коротко Home': 'To pair: switch to 2.4G, then short Home',
  'Клик по кнопке, триггеру, бамперу — нажатие': 'Click a button, trigger or bumper to press it',
  'Тянуть стик мышью — наклон, клик по стику — L3/R3': 'Drag a stick to tilt it, click a stick for L3/R3',
  'Клавиши: WASD — левый стик, стрелки — правый, TFGH — крестовина, 1–4 — A/B/X/Y, Q/E — LB/RB, Z/C — LT/RT, V/B — M1/M2, M — режим, Space — Home (удержание 3 с — сопряжение), N — T (держать + стрелки ↑↓ правого стика — вибрация), U — кабель в ПК, J — кабель в зарядку, R — ресивер в USB':
    'Keys: WASD — left stick, arrows — right stick, TFGH — D-pad, 1–4 — A/B/X/Y, Q/E — LB/RB, Z/C — LT/RT, V/B — M1/M2, M — mode, Space — Home (hold 3 s — pairing), N — T (hold + right stick ↑↓ — vibration), U — cable to PC, J — cable to charger, R — receiver to USB',
  'Снизу: клик по лопаткам M1/M2, клик по краю ручки переключателя сдвигает её': 'Underneath: click the M1/M2 paddles; clicking an edge of the switch knob moves it',
  'Настоящий геймпад управляет моделью через Gamepad API': 'A real gamepad drives the model through the Gamepad API',
  // ---- app.js ----
  'Геймпад: ': 'Gamepad: ',
  'Геймпад не подключён — нажмите любую кнопку на нём': 'No gamepad connected — press any button on it',
  '{}: сначала выньте ресивер': '{}: remove the receiver first',
  '{}: сначала выньте кабель из ПК': '{}: unplug the cable from the PC first',
  'красный': 'red', 'фиолетовый': 'purple', 'голубой': 'cyan', 'зелёный': 'green', 'белый': 'white',
  'HOME при активной связи — кнопка «Домой»': 'HOME while connected — the “Home” button',
  'HOME 5 с — геймпад выключен': 'HOME 5 s — gamepad turned off',
  'горит': 'steady', 'не горит': 'off',
  'мигает 1 раз/с — подключение': 'blinks once a second — connecting',
  'мигает 2 раза/с — сопряжение': 'blinks twice a second — pairing',
  'мигает 1 раз в 3 с — кабель': 'blinks once every 3 s — cable',
  'быстро мигает белым — запись макроса': 'fast white blinking — macro recording',
  'Кабель в ПК и ресивер в ПК одновременно нельзя — конфликт подключений':
    'Cable to the PC and receiver in the PC at the same time are not allowed — connection conflict',
  'Кабель геймпада в USB ноутбука / вынуть (клавиша U)': 'Gamepad cable to a laptop USB port / unplug (key U)',
  'Вставить ресивер 2.4G в USB ноутбука / вынуть (клавиша R)': 'Insert the 2.4G receiver into a laptop USB port / remove (key R)',
  'Ресивер 2.4G: ': '2.4G receiver: ',
  'вставляется…': 'inserting…', 'не вставлен — не горит': 'not inserted — off',
  'сопряжён — горит красным': 'paired — steady red', 'ждёт сопряжения — мигает красным 1 раз/с': 'waiting for pairing — blinks red once a second',
  'треуг.': 'tris', 'МБ': 'MB', 'загрузка': 'load', 'мс': 'ms',
  'Геймпад выключен — включите его (коротко HOME), затем T + правый стик': 'The gamepad is off — turn it on (short HOME), then T + right stick',
  'выключена': 'off', '{} из {}': '{} of {}', 'Вибрация: {}': 'Vibration: {}',
  'T удерживается — правый стик ↑ сильнее, ↓ слабее': 'T held — right stick ↑ stronger, ↓ weaker',
  'Настройка сохранена': 'Setting saved',
  'Кнопка {}: {}': 'Button {}: {}',
  'турбо снято — обычный режим': 'turbo removed — normal mode',
  'TURBO — повторы, пока держите': 'TURBO — repeats while held', 'AUTO — повторы без удержания': 'AUTO — repeats without holding',
  'Скорость сохранена: {} нажатий/с': 'Speed saved: {} presses/s',
  'Скорость турбо: {} нажатий/с — отпустите T, чтобы сохранить': 'Turbo speed: {} presses/s — release T to save',
  'AUTO {}/с': 'AUTO {}/s', 'TURBO {}/с': 'TURBO {}/s',
  'обычный режим': 'normal mode', 'TURBO · {} нажатий/с, пока держите': 'TURBO · {} presses/s while held',
  'AUTO · {} нажатий/с': 'AUTO · {} presses/s', 'Кнопка {} — {}': 'Button {} — {}',
  'палец держит': 'finger holds', 'уходит в игру': 'sent to game',
  'Крестовина {}': 'D-pad {}', 'Левый стик {}': 'Left stick {}', 'Правый стик {}': 'Right stick {}', 'Нажато:': 'Pressed:',
  '{} + SELECT: держать до быстрого мигания': '{} + SELECT: hold until fast blinking',
  'Запись {}: отпустите {} и SELECT': 'Recording {}: release {} and SELECT',
  'Запись {}: нажимайте кнопки, затем {}': 'Recording {}: press buttons, then {}',
  '{}: сохранено': '{}: saved', '{}: сброшено': '{}: cleared', '{}: выполняется': '{}: playing',
  '{}: выполняется (замедленно ×{})': '{}: playing (slowed ×{})', '{}: выполнено': '{}: done', 'пусто': 'empty',
  // ---- экран ноутбука: Windows 11 ----
  'Добавление устройства Bluetooth': 'Add a Bluetooth Device', 'Разрешить подключение устройства': 'Allow a Device to Connect',
  'Показать устройства Bluetooth': 'Show Bluetooth Devices', 'Отправить файл': 'Send a File', 'Принять файл': 'Receive a File',
  'Присоединиться к личной сети (PAN)': 'Join a Personal Area Network', 'Открыть параметры': 'Open Settings', 'Удалить значок': 'Remove Icon',
  'Главная': 'Home', 'Система': 'System', 'Bluetooth и устройства': 'Bluetooth & devices', 'Сеть и Интернет': 'Network & internet',
  'Персонализация': 'Personalization', 'Приложения': 'Apps', 'Учетные записи': 'Accounts', 'Время и язык': 'Time & language',
  'Игры': 'Gaming', 'Специальные возможности': 'Accessibility', 'Конфиденциальность и защита': 'Privacy & security',
  'Центр обновления Windows': 'Windows Update', 'Настройки': 'Settings', '⌕  Найти параметр': '⌕  Find a setting',
  'Пользователь': 'User', 'Локальная учетная запись': 'Local Account', '›   Устройства': '›   Devices',
  'Обнаруживаемый как "LAPTOP"': 'Discoverable as "LAPTOP"', 'Вкл.': 'On',
  'Подключить новое устройство к "LAPTOP"': 'Connect a new device to "LAPTOP"', 'Добавить устройство': 'Add device',
  'Ввод': 'Input', 'Беспроводная мышь': 'Wireless Mouse', 'Аудио': 'Audio', 'Наушники Bluetooth': 'Bluetooth Headphones',
  'Сопряжено': 'Paired', 'Подключить': 'Connect', 'Другие устройства': 'Other devices', 'Bluetooth-адаптер': 'Bluetooth adapter',
  'Выберите тип устройства, которое нужно добавить.': 'Choose the kind of device you want to add.',
  'Звуковые устройства, мыши, клавиатуры, телефоны, ручки, контроллеры и прочее': 'Audio devices, mice, keyboards, pens, phones, controllers, and more',
  'Беспроводной дисплей или док-станция': 'Wireless display or dock',
  'Беспроводные мониторы, телевизоры и компьютеры (Miracast)': 'Wireless monitors, TVs, or PCs that use Miracast',
  'Все остальное': 'Everything else', 'Контроллеры Xbox с беспроводным адаптером Xbox, DLNA и другие': 'Xbox controllers with Wireless Adapter, DLNA, and more',
  'Отмена': 'Cancel', 'Убедитесь, что ваше устройство включено и доступно для обнаружения.': 'Make sure your device is turned on and discoverable.',
  'Выберите устройство ниже, чтобы подключиться.': 'Select a device below to connect.', 'Подключение...': 'Connecting...',
  'Показать все устройства': 'Show all devices', 'Ваше устройство готово к': 'Your device is ready', 'использованию!': 'to go!',
  'Подключено': 'Connected', 'Готово': 'Done',
  // ---- инструкции: шаги ----
  'Правой кнопкой по значку Bluetooth в трее': 'Right-click the Bluetooth icon in the tray',
  '«Добавление устройства Bluetooth»': '“Add a Bluetooth Device”',
  'В «Параметрах» нажмите «Добавить устройство»': 'In Settings, click “Add device”',
  'Выберите «Bluetooth» — начнётся поиск': 'Choose “Bluetooth” — the search starts',
  'Переключатель на дне — в нужный режим': 'Set the switch on the bottom to the chosen mode',
  'Зажмите HOME на 3 с — сначала медленное, затем быстрое мигание': 'Hold HOME for 3 s — slow, then fast blinking',
  'В списке появится геймпад — нажмите на него': 'The gamepad appears in the list — click it',
  'Подключение…': 'Connecting…', 'Подключено — HOME горит постоянно': 'Connected — HOME is steady',
  'Геймпад уже сопряжён: в «Параметрах», раздел «Ввод» — «Сопряжено»': 'Already paired: Settings, “Input” section — “Paired”',
  'Коротко нажмите HOME': 'Briefly press HOME', 'Индикатор мигает — идёт подключение': 'The LED blinks — connecting',
  'Через пару секунд горит постоянно': 'A couple of seconds later it is steady',
  'В «Параметрах» под геймпадом — «Подключено»': 'In Settings, under the gamepad — “Connected”',
  'Геймпад должен быть включён или подключён': 'The gamepad must be on or connected',
  'Зажмите T (Турбо) и удерживайте': 'Press and hold T (Turbo)', 'Правый стик вверх — вибрация сильнее': 'Right stick up — stronger vibration',
  'Правый стик вниз — слабее, до выключения': 'Right stick down — weaker, down to off', 'Отпустите T — настройка сохранена': 'Release T — setting saved',
  'Зажмите A и удерживайте': 'Press and hold A', 'Коротко нажмите T — на A назначено турбо': 'Briefly press T — turbo assigned to A',
  'Держите A: в игру идут повторные нажатия': 'Hold A: repeated presses go to the game',
  'Скорость: зажмите T и левым стиком ↑/↓ (8 / 15 / 25 нажатий/с)': 'Speed: hold T and move the left stick ↑/↓ (8 / 15 / 25 presses/s)',
  'Отпустите T — скорость сохранена': 'Release T — speed saved',
  'AUTO: держите A (на ней TURBO) и коротко нажмите T': 'AUTO: hold A (TURBO is on it) and briefly press T',
  'Отпустите A — кнопка нажимается сама': 'Release A — the button presses itself',
  'Снять турбо: держите A и дважды быстро нажмите T': 'Remove turbo: hold A and double-tap T',
  'Отпустите A — кнопка снова обычная': 'Release A — the button is normal again',
  'Вставьте ресивер в USB-порт ПК — он мигает красным': 'Insert the receiver into a PC USB port — it blinks red',
  'Переключатель на дне — в 2.4G': 'Set the switch on the bottom to 2.4G',
  'Почти сразу: HOME горит голубым, ресивер — красным': 'Almost instantly: HOME steady cyan, receiver steady red',
  'В «Параметрах», «Другие устройства» — «Xbox360 For Windows»': 'In Settings, “Other devices” — “Xbox360 For Windows”',
  'Кабель в ПК вместе с ресивером нельзя — вынимаем кабель': 'Cable to the PC together with the receiver is not allowed — unplugging the cable',
  'Ресивер уже в USB-порту ПК, переключатель — в 2.4G': 'The receiver is already in a PC USB port, the switch is at 2.4G',
  'Геймпад выключен — ресивер мигает красным, ждёт': 'The gamepad is off — the receiver blinks red, waiting',
  '«Другие устройства» — «Xbox360 For Windows» снова в списке': '“Other devices” — “Xbox360 For Windows” is back in the list',
  'Ресивер уже в ПК — геймпад сопрягался с ним раньше': 'The receiver is already in the PC — the gamepad was paired with it before',
  'Кабель: USB-A в ПК, Type-C в геймпад': 'Cable: USB-A to the PC, Type-C to the gamepad',
  'HOME мигает 1 раз в 3 с — питание от ПК': 'HOME blinks once every 3 s — powered by the PC',
  'В «Параметрах», «Другие устройства» — геймпад': 'In Settings, “Other devices” — the gamepad',
  'Ресивер в ПК вместе с кабелем нельзя — вынимаем ресивер': 'Receiver in the PC together with the cable is not allowed — removing the receiver',
  'Зажмите M1 на обратной стороне': 'Press and hold M1 on the back', 'Не отпуская M1, зажмите SELECT': 'Keep M1 held and press and hold SELECT',
  'Держите, пока HOME не замигает быстро белым': 'Hold until HOME blinks fast white', 'Отпустите M1 и SELECT': 'Release M1 and SELECT',
  'Нажимайте кнопки или сочетания: A → B → X + Y вместе': 'Press buttons or combinations: A → B → X + Y together',
  'Ещё раз M1 — сохранено': 'M1 again — saved', 'Коротко M1 — макрос выполняется': 'Short M1 — the macro plays',
  'Сброс: M1 + SELECT до быстрого мигания, отпустить, ещё раз M1': 'Reset: M1 + SELECT until fast blinking, release, M1 again',
  'M1 больше ничего не выполняет': 'M1 no longer plays anything',
  ' (через {} с)': ' (after {} s)', ' (за {} с)': ' (in {} s)', ' («{}»)': ' (“{}”)', ' — включаем снова': ' — turning it back on',
  '2.4G — не Bluetooth: выберите X, V3, M или S либо инструкцию «Через ресивер 2.4G»':
    '2.4G is not Bluetooth: choose X, V3, M or S, or the “2.4G receiver” guide',
  // ---- инструкции: указатели ----
  'Зажать HOME на 3 сек.': 'Hold HOME for 3 s', 'Удерживайте HOME… {}': 'Keep holding HOME… {}',
  'медленно мигает — как при кратком нажатии': 'slow blinking — as after a short press',
  'Режим сопряжения': 'Pairing mode', 'индикатор быстро мигает — можно отпустить': 'fast blinking — you can release',
  'Коротко нажать HOME': 'Briefly press HOME', 'индикатор мигает 1 раз/с': 'the LED blinks once a second',
  'нет подключения': 'no connection', 'нет сопряжения': 'not paired',
  'геймпад включится': 'the gamepad turns on', 'Геймпад включён': 'The gamepad is on',
  'индикатор мигает — ищет устройство': 'the LED blinks — looking for a device', 'индикатор горит или мигает': 'the LED is steady or blinking',
  'Зажать T и удерживать': 'Press and hold T', 'кнопка «Турбо»': 'the “Turbo” button', 'T удерживается': 'T is held',
  'Правый стик ↑ — сильнее': 'Right stick ↑ — stronger', 'Правый стик ↓ — слабее': 'Right stick ↓ — weaker',
  'Отпустить T': 'Release T', 'Сохранено: {} из 3': 'Saved: {} of 3',
  'Зажать A и удерживать': 'Press and hold A', 'Коротко нажать T': 'Briefly press T', 'A не отпускаем': 'keep A held',
  'A держим — повторы': 'A held — repeats', 'смотрите сигнал справа сверху': 'see the signal at the top right',
  'Отпустили — повторы прекратились': 'Released — repeats stopped', 'Зажать T': 'Press and hold T',
  'Левый стик ↑ — быстрее': 'Left stick ↑ — faster', 'Левый стик ↓ — медленнее': 'Left stick ↓ — slower',
  'Держать A': 'Hold A', 'повторы {} нажатий/с': 'repeats at {} presses/s', 'A отпущена': 'A released',
  'повторы идут сами — AUTO': 'repeats keep going — AUTO', 'Зажать A и дважды быстро T': 'Hold A and double-tap T',
  'Отпустить A': 'Release A', 'турбо снято': 'turbo removed', 'обычный режим — одно непрерывное нажатие': 'normal mode — one continuous press',
  'Другие кнопки — так же': 'Other buttons work the same way',
  'Зажать M1': 'Press and hold M1', 'и держать': 'and keep holding', 'Зажать SELECT': 'Press and hold SELECT', 'M1 не отпускаем': 'keep M1 held',
  'Держать оба…': 'Hold both…', 'ждём быстрого белого мигания': 'waiting for fast white blinking',
  'HOME быстро мигает белым': 'HOME blinks fast white', 'режим записи M1': 'M1 recording mode',
  'Отпустить M1 и SELECT': 'Release M1 and SELECT', 'теперь можно назначать кнопки': 'now you can assign buttons',
  'Нажать {}': 'Press {}', 'шаг {} записан — смотрите строку сверху': 'step {} recorded — see the strip at the top',
  'Нажать X + Y вместе': 'Press X + Y together', 'сочетание — один шаг': 'a combination is one step',
  'Нажать M1 ещё раз': 'Press M1 again', 'сохранить': 'to save', 'HOME горит постоянно': 'HOME is steady',
  'макрос A → B → X + Y сохранён': 'macro A → B → X + Y saved', 'Коротко M1': 'Short M1',
  'замедленно ×5: шаги по очереди — A, B, X + Y': 'slowed ×5: steps one by one — A, B, X + Y',
  'Ещё раз M1': 'M1 again', 'на реальной скорости — 0.6 с': 'at real speed — 0.6 s',
  'Сброс: зажать M1': 'Reset: press and hold M1', 'и держать; макрос сработает — так и должно быть': 'and keep holding; the macro will play — that is expected',
  'держать до быстрого мигания': 'hold until fast blinking', 'Отпустить оба': 'Release both', 'ничего не нажимаем': 'press nothing',
  'сброс': 'reset', 'макрос M1 сброшен': 'macro M1 cleared', 'макроса нет — ничего не происходит': 'no macro — nothing happens',
  'HOME мигает 1 раз в 3 с': 'HOME blinks once every 3 s', 'параллельно идёт зарядка от ПК': 'charging from the PC at the same time',
  'идёт зарядка': 'charging',
};
// шаблоны: длинные раньше коротких, чтобы «{}: выполняется (замедленно ×{})» не съел «{}: выполняется»
const PATTERNS = Object.keys(EN).filter(k => k.includes('{}')).sort((a, b) => b.length - a.length)
  .map(k => [new RegExp('^' + k.split('{}').map(s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('(.+?)') + '$', 's'), EN[k]]);

let lang = 'ru';
try { lang = localStorage.getItem('g6.lang') === 'en' ? 'en' : 'ru'; } catch { /* хранилище недоступно */ }
const subs = [];
export const getLang = () => lang;
export function t(s) {
  if (lang === 'ru' || s == null || s === '') return s;
  const e = EN[s]; if (e !== undefined) return e.replace(/\{\}/g, '');
  // Подходить могут несколько шаблонов: «Кнопка A: TURBO — повторы…» ловят и «Кнопка {}: {}», и
  // «Кнопка {} — {}» (замер: второй давал «Button A: TURBO — повторы…» наполовину по-русски). Берём
  // первый, после которого не осталось кириллицы.
  let first = null;
  for (const [re, out] of PATTERNS) {
    const m = s.match(re); if (!m) continue;
    let i = 0; const r = out.replace(/\{\}/g, () => t(m[++i]));
    if (!/[А-Яа-яЁё]/.test(r)) return r;
    first ??= r;
  }
  return first ?? s;
}
// статичный текст панели: data-i18n — текст элемента, data-i18n-title — подсказка; русский оригинал
// запоминаем при первом проходе
export function applyStatic(rootEl = document) {
  for (const el of rootEl.querySelectorAll('[data-i18n]')) { el.dataset.ru ??= el.textContent; el.textContent = t(el.dataset.ru); }
  for (const el of rootEl.querySelectorAll('[data-i18n-title]')) { el.dataset.ruTitle ??= el.title; el.title = t(el.dataset.ruTitle); }
  document.documentElement.lang = lang;
}
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'ru';
  try { localStorage.setItem('g6.lang', lang); } catch { /* без запоминания */ }
  applyStatic(); subs.forEach(f => f(lang));
}
export const onLang = f => subs.push(f);
applyStatic();
