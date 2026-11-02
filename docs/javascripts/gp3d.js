// Интерактивная 3D-модель геймпада (.gp-3d). Рисуется на Three.js с тулшейдингом
// (MeshToonMaterial + настоящие мягкие тени от деталей друг на друга) — под стиль
// чертежа сайта, а не фотореалистичным PBR. Грузится только на страницах с
// .gp-3d[data-gp3d].

(function () {
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
  var ADDONS_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/";
  var modulesLoading = null;

  function ensureImportMap() {
    if (document.querySelector('script[type="importmap"]')) return;
    var s = document.createElement("script");
    s.type = "importmap";
    s.textContent = JSON.stringify({ imports: { three: THREE_URL, "three/addons/": ADDONS_URL } });
    document.head.appendChild(s);
  }

  function loadModules() {
    if (!modulesLoading) {
      ensureImportMap();
      modulesLoading = Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/controls/OrbitControls.js"),
      ]).then(function (mods) {
        return { THREE: mods[0], GLTFLoader: mods[1].GLTFLoader, OrbitControls: mods[2].OrbitControls };
      });
    }
    return modulesLoading;
  }

  // Цвета индикации HOME по режиму — совпадают с таблицей «Режимы» на странице.
  var MODE_EMISSIVE = {
    X: [0.12, 0.38, 1],
    "2.4G": [0.12, 0.38, 1],
    S: [0.15, 0.85, 0.3],
    M: [0.58, 0.18, 0.92],
    V3: [0.95, 0.15, 0.12],
  };
  var MODE_LED_CSS = { X: "#2f63ff", "2.4G": "#2f63ff", S: "#26d947", M: "#9430eb", V3: "#f22620" };
  // Порядок положений переключателя слева направо на самой модели (см. фото
  // крупным планом: V3 — M — X — S — 2.4G), смещение диска в метрах по его
  // локальной продольной оси.
  var DIAL_SLIDE_X = { V3: -0.0095, M: -0.0048, X: 0, S: 0.0048, "2.4G": 0.0095 };
  var HOME_PRESS_Z = -0.0009;
  var MODE_TEXT = {
    X: "Сдвиньте переключатель в <b>X</b>, зажмите <b>HOME</b> 3&nbsp;сек — индикатор замигает синим, затем будет гореть ровно. Режим X-input: ПК, консольный/ПК-стриминг, Android/iOS/HarmonyOS.",
    "2.4G": "Сдвиньте переключатель в <b>2.4G</b>, зажмите <b>HOME</b> 3&nbsp;сек — индикатор синий. Нужен USB-ресивер (докупается отдельно). Подходит для ПК и Android.",
    S: "Сдвиньте переключатель в <b>S</b>, зажмите <b>HOME</b> 3&nbsp;сек — индикатор зелёный. Режим для Nintendo Switch.",
    M: "Сдвиньте переключатель в <b>M</b>, зажмите <b>HOME</b> 3&nbsp;сек — индикатор фиолетовый. MFi: iOS/Android/HarmonyOS (видно как «DUALSHOCK 4»), а также стриминг с PS4/PS5.",
    V3: "Сдвиньте переключатель в <b>V3</b>, зажмите <b>X</b>, затем <b>HOME</b> — индикатор красный. Для игр с прицеливанием на Android/HarmonyOS (нужно приложение ShootingPlus V3).",
  };

  // Палитра снята с референсного фото белой расцветки корпуса от производителя —
  // единственная расцветка на этой странице, переключателя цвета корпуса нет.
  var BODY_COLOR = [0.94, 0.93, 0.9];
  var REST_COLOR = [0.6, 0.6, 0.61];

  function buildScene(root, mats) {
    var THREE = mats.THREE;
    // Управление цветовым пространством отключаем: простые плоские цвета без
    // пересчёта sRGB/linear, и заодно убирает конвертацию как источник проблем.
    THREE.ColorManagement.enabled = false;
    var stage = root.querySelector(".gp-3d__stage");
    var W = stage.clientWidth, H = stage.clientHeight;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.appendChild(renderer.domElement);

    var overlay = document.createElement("div");
    overlay.className = "gp-3d__overlay";
    stage.appendChild(overlay);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 10);
    var target = new THREE.Vector3(0, 0, 0.025);
    camera.position.set(0, 0.1, 0.2);
    camera.lookAt(target);

    var controls = new mats.OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 0.08;
    controls.maxDistance = 0.4;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.3;

    // толшейдинг: ступенчатая градиентная карта.
    // RGBA, а не однокальный RedFormat — тот требует WebGL2 и на части видеокарт/
    // браузеров сэмплится как попало, разваливая тон-шейдинг в чистый чёрно-белый
    // плакат без полутонов. RGBA работает везде одинаково.
    var steps = 5;
    var data = new Uint8Array(steps * 4);
    for (var i = 0; i < steps; i++) {
      var v = Math.round(70 + (i / (steps - 1)) * 185); // 70..255, без чистого чёрного
      data[i * 4 + 0] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    var gradMap = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
    gradMap.needsUpdate = true;
    gradMap.minFilter = THREE.NearestFilter;
    gradMap.magFilter = THREE.NearestFilter;
    gradMap.generateMipmaps = false;
    gradMap.wrapS = THREE.ClampToEdgeWrapping;
    gradMap.wrapT = THREE.ClampToEdgeWrapping;

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2f28, 0.4));
    // key — основной источник теней (кнопки/стики/крестовина отбрасывают тень
    // на корпус и друг на друга — это и читает объём там, где раньше была
    // чёрная обводка). Фрустум тени подогнан под размер модели (~0.16м).
    var key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(0.5, 0.8, 0.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.05;
    key.shadow.camera.far = 1.2;
    key.shadow.camera.left = -0.09;
    key.shadow.camera.right = 0.09;
    key.shadow.camera.top = 0.09;
    key.shadow.camera.bottom = -0.09;
    key.shadow.bias = -0.0015;
    key.shadow.radius = 2.5;
    scene.add(key);
    var rimLight = new THREE.DirectionalLight(0xffe0c0, 0.65);
    rimLight.position.set(-0.6, 0.35, -0.55);
    scene.add(rimLight);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.ShadowMaterial({ opacity: 0.32 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.042;
    ground.receiveShadow = true;
    scene.add(ground);

    // Анимация нажатия HOME и сдвига диска режима — целевые значения и ссылки
    // на меши (homeMesh/dialMesh) выставляются снаружи, после загрузки
    // модели (paintModel), тут только плавно догоняем текущее до целевого.
    var anim = { homeZ: 0, homeTargetZ: 0, dialX: 0, dialTargetX: 0, homeMesh: null, dialMesh: null };
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      anim.homeZ += (anim.homeTargetZ - anim.homeZ) * 0.25;
      anim.dialX += (anim.dialTargetX - anim.dialX) * 0.22;
      if (anim.homeMesh) anim.homeMesh.position.z = anim.homeZ;
      if (anim.dialMesh) anim.dialMesh.position.x = anim.dialX;
      renderer.render(scene, camera);
      updateHotspots();
    }

    var hotspots = [];
    var _v = new THREE.Vector3();
    var _camToPt = new THREE.Vector3();
    function updateHotspots() {
      var w = stage.clientWidth, h = stage.clientHeight;
      for (var k = 0; k < hotspots.length; k++) {
        var hs = hotspots[k];
        _v.copy(hs.pos).project(camera);
        var x = (_v.x * 0.5 + 0.5) * w;
        var y = (-_v.y * 0.5 + 0.5) * h;
        _camToPt.copy(camera.position).sub(hs.pos).normalize();
        var facing = _camToPt.dot(hs.normal) > -0.15;
        var onScreen = _v.z < 1 && x > -20 && x < w + 20 && y > -20 && y < h + 20;
        hs.el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%)";
        hs.el.style.opacity = facing && onScreen ? "1" : "0";
        hs.el.style.pointerEvents = facing && onScreen ? "auto" : "none";
      }
    }

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(stage);

    return { THREE: THREE, scene: scene, camera: camera, controls: controls, target: target, gradMap: gradMap, hotspots: hotspots, overlay: overlay, animate: animate, anim: anim };
  }

  // Детали, покрашенные в цвет корпуса, а не в серый «остальное»: накладки
  // бамперов, служебные кнопки SELECT/START/TURBO и кнопки Y/X/B/A — на
  // референсном фото они белые, как корпус, в отличие от крестовины, стиков,
  // грипов и курков, которые серые. Имена — узлы g6-rigged.glb (geometry
  // хирургия: отдельные объекты под каждую реально отделяемую деталь — body,
  // home, оба стика, крестовина, диск режима; см. память проекта).
  function partKind(name) {
    if (name === "PART_HOME") return "home";
    if (name.indexOf("PART_BODY") === 0) return "body";
    if (name.indexOf("PART_SHOULDER") === 0) return "body";
    if (name === "PART_FACE_BUTTONS" || name === "PART_UTIL_BUTTONS") return "body";
    return "rest";
  }

  function paintModel(ctx, gltfRoot) {
    var THREE = ctx.THREE;
    var bodyC = new THREE.Color(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    var restC = new THREE.Color(REST_COLOR[0], REST_COLOR[1], REST_COLOR[2]);
    var materials = { body: [], home: [], homeMesh: null, dialMesh: null };

    // Снимок узлов ДО обхода: добавлять обводку как дочерний узел прямо во
    // время traverse() нельзя — новый узел попадает в тот же живой список
    // children и traverse заходит в него снова (бесконечная рекурсия).
    var meshes = [];
    gltfRoot.traverse(function (obj) {
      if (obj.isMesh) meshes.push(obj);
    });

    meshes.forEach(function (obj) {
      var kind = partKind(obj.name);
      var tm = new THREE.MeshToonMaterial();
      tm.gradientMap = ctx.gradMap;
      if (kind === "body") {
        tm.color.copy(bodyC);
        materials.body.push(tm);
      } else if (kind === "home") {
        tm.color.set(0.04, 0.04, 0.05);
        tm.emissive = new THREE.Color(0.12, 0.38, 1);
        tm.emissiveIntensity = 1.1;
        materials.home.push(tm);
      } else {
        tm.color.copy(restC);
      }
      obj.material = tm;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.name === "PART_HOME") materials.homeMesh = obj;
      if (obj.name === "PART_DIAL") materials.dialMesh = obj;
    });
    return materials;
  }

  function addHotspotEls(root, ctx, THREE) {
    var buttons = root.querySelectorAll(".gp-3d__hotspot[data-position]");
    buttons.forEach(function (btn) {
      ctx.overlay.appendChild(btn);
      var p = btn.dataset.position.split(" ").map(Number);
      var n = btn.dataset.normal.split(" ").map(Number);
      ctx.hotspots.push({ el: btn, pos: new THREE.Vector3(p[0], p[1], p[2]), normal: new THREE.Vector3(n[0], n[1], n[2]) });
    });
  }

  function pressHome(ctx) {
    ctx.anim.homeTargetZ = HOME_PRESS_Z;
    setTimeout(function () { ctx.anim.homeTargetZ = 0; }, 260);
  }

  function setMode(root, ctx, materials, mode, skipAnim) {
    var THREE = ctx.THREE;
    var c = MODE_EMISSIVE[mode] || [0.5, 0.5, 0.55];
    materials.home.forEach(function (m) { m.emissive.setRGB(c[0], c[1], c[2]); });
    root.querySelectorAll(".gp-3d__mode").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.mode === mode);
    });
    var info = root.querySelector("[data-mode-info]");
    if (info) {
      info.innerHTML =
        '<span class="gp-3d__led" style="color:' + (MODE_LED_CSS[mode] || "#888") + '"></span>' + (MODE_TEXT[mode] || "");
    }
    if (DIAL_SLIDE_X[mode] !== undefined) ctx.anim.dialTargetX = DIAL_SLIDE_X[mode];
    if (!skipAnim) pressHome(ctx);
  }

  function setView(ctx, view) {
    ctx.controls.autoRotate = false;
    var THREE = ctx.THREE;
    var r = ctx.camera.position.distanceTo(ctx.controls.target) || 0.19;
    var z = view === "back" ? -r : r;
    ctx.camera.position.set(0, ctx.controls.target.y + r * 0.42, ctx.controls.target.z + z * 0.9);
    ctx.controls.update();
  }

  function initViewer(root) {
    if (root.dataset.gp3dReady) return;
    root.dataset.gp3dReady = "1";

    loadModules().then(function (mats) {
      var ctx = buildScene(root, mats);
      var loader = new mats.GLTFLoader();
      loader.load(root.dataset.src, onModelLoaded);

      function onModelLoaded(gltf) {
        var gltfRoot = gltf.scene;
        var materials = paintModel(ctx, gltfRoot);
        ctx.anim.homeMesh = materials.homeMesh;
        ctx.anim.dialMesh = materials.dialMesh;
        ctx.scene.add(gltfRoot);
        addHotspotEls(root, ctx, mats.THREE);
        ctx.animate();

        root.querySelectorAll(".gp-3d__view").forEach(function (btn) {
          btn.addEventListener("click", function () {
            setView(ctx, btn.dataset.view);
            root.querySelectorAll(".gp-3d__view").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
          });
        });
        root.querySelectorAll(".gp-3d__mode").forEach(function (btn) {
          btn.addEventListener("click", function () { setMode(root, ctx, materials, btn.dataset.mode); });
        });
        var firstMode = root.querySelector(".gp-3d__mode");
        if (firstMode) setMode(root, ctx, materials, firstMode.dataset.mode, true);

        var hint = root.querySelector(".gp-3d__hint");
        root.addEventListener(
          "pointerdown",
          function stop() {
            ctx.controls.autoRotate = false;
            if (hint) hint.classList.add("is-gone");
            root.removeEventListener("pointerdown", stop);
          },
          { once: true }
        );
      }
    });
  }

  document$.subscribe(function () {
    var roots = document.querySelectorAll(".gp-3d[data-gp3d]");
    if (!roots.length) return;
    roots.forEach(initViewer);
  });
})();
