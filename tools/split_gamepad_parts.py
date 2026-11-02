# Разделяет STEP→GLB модель геймпада (см. tools/ как точку входа для будущих
# моделей) на отдельные объекты: корпус + реально отделяемые подвижные детали
# (HOME, оба стика, крестовина, диск режима режима на задней панели) — для
# покраски по частям и покнопочной анимации во вьюере (docs/javascripts/gp3d.js).
#
# ВАЖНО: KNOWN_POINTS, REGIONS, L3_POINT/R3_POINT и имена mat_N — специфичны
# для модели G6 (docs/assets/g6/g6-rigged.glb) и получены ВРУЧНУЮ методом
# «покрасить-и-изолировать» в живом Three.js-вьюере (см. память проекта,
# memory/project_g6_parts_separation.md) — для каждой следующей модели их
# нужно заново находить тем же способом, этот скрипт лишь шаблон подхода.
#
# Что подтверждено РАБОЧИМ в этой модели (есть настоящий геометрический шов):
#   HOME, Y/X/B/A (одним блоком), SELECT/START/TURBO (одним блоком),
#   оба стика (найдены внутри gigантского mat_14 как тонкие кольца-бортики),
#   крестовина (отдельный мелкий меш mat_6!), диск режима (вырезан по радиусу
#   из гигантского mat_0).
# Что НЕ отделяется (сварено с корпусом/боковиной без шва в этом STEP-файле):
#   M1/M2, курки RT/RB и LT/LB — без ручного редактирования в 3D-пакете (Blender
#   и т.п.) не вырезать.
#
# Ключевой урок про геометрию: CAD-патчи из STEP не сварены по вершинам на
# стыках (независимая тесселяция), поэтому connected-components то рвётся на
# сотни обломков, то слипает соседние кнопки через тонкие перемычки — для
# кластеров кнопок (Y/X/B/A, SELECT/START/TURBO) ни один метод разреза не дал
# устойчивого результата, и они оставлены целыми группами (см. ниже).
#
# Второй урок (всплыл при пересборке в HD-разрешении): собственный numpy-
# сварщик вершин (welded_components ниже) ПЕРЕСТАЛ быть надёжным при смене
# плотности сетки — тот же допуск (digits_vertex=3), что работал на низком
# разрешении, на HD склеивал геометрически несвязанные куски в один меш с
# десятками тысяч вырожденных граней ("мозаика"/кракозябры на рендере вместо
# гладкой поверхности). Для стиков (mat_14) это разделение вынесено в Blender
# (tools/blender_split_sticks.py — тот же принцип Merge by Distance + Separate
# by Loose Parts, но проверенная реализация с возможностью свериться в GUI).
# welded_components оставлена в файле как рабочая техника для случаев попроще
# (сейчас не вызывается) — не доверяйте одному фиксированному допуску вслепую,
# при смене детализации модели его нужно перепроверять.

import numpy as np
import trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

SRC = r"C:\gamepads\docs\assets\g6\g6_hd.glb"  # cascadio, tol_linear=0.06/tol_angular=0.3
STICKS_SRC = r"C:\gamepads\docs\assets\g6\g6_sticks_split.glb"  # см. tools/blender_split_sticks.py
OUT = r"C:\gamepads\docs\assets\g6\g6-rigged.glb"

# Опорные 3D-точки (локальные координаты модели, метры) — найдены через
# mv.positionAndNormalFromPoint()/raycaster по живой модели в браузере.
KNOWN_POINTS = {
    "Y": (0.03124, 0.00072, 0.05423), "X": (0.01927, -0.00793, 0.05412),
    "B": (0.04079, -0.00787, 0.05252), "A": (0.03021, -0.01999, 0.05248),
    "SELECT": (-0.01555, -0.00496, 0.05449), "START": (0.00050, -0.00616, 0.05453),
    "TURBO": (-0.00658, -0.01588, 0.05366), "DIAL": (0.00031, -0.02723, 0.02848),
}


def welded_components(geom, digits=3, min_verts=15):
    """Сварить вершины по позиции (CAD-патчи STEP не сварены на стыках) и
    вернуть список связных кусков геометрии. digits=3 (~1мм) — рабочий
    компромисс для этой модели; меньше — расползается на сотни обломков,
    больше — склеивает соседние детали."""
    g = geom.copy()
    g.merge_vertices(merge_tex=True, merge_norm=True, digits_vertex=digits)
    n = len(g.vertices)
    faces = np.asarray(g.faces)
    rows = np.concatenate([faces[:, 0], faces[:, 1], faces[:, 2]])
    cols = np.concatenate([faces[:, 1], faces[:, 2], faces[:, 0]])
    adj = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n))
    ncomp, labels = connected_components(adj, directed=False)
    pos_all = np.asarray(g.vertices)
    norm_all = np.asarray(g.vertex_normals)
    out = []
    for c in range(ncomp):
        vids = np.where(labels == c)[0]
        if len(vids) < min_verts:
            continue
        remap = -np.ones(n, dtype=np.int64)
        remap[vids] = np.arange(len(vids))
        fmask = (labels[faces[:, 0]] == c) & (labels[faces[:, 1]] == c) & (labels[faces[:, 2]] == c)
        comp_faces = remap[faces[fmask]]
        out.append({"positions": pos_all[vids], "normals": norm_all[vids], "faces": comp_faces})
    return out


scene = trimesh.load(SRC, process=False)
new_scene = trimesh.Scene()
handled_names = set()

# Y/X/B/A (mat_15) и SELECT/START/TURBO (mat_12) — оставлены ЦЕЛИКОМ одной
# группой на кластер (красятся верно, но без покнопочной анимации — разрез
# по отдельным кнопкам не прошёл порог качества, см. шапку файла).
for mesh_name, group_name in [("COMPOUND_16", "PART_FACE_BUTTONS"), ("COMPOUND_13", "PART_UTIL_BUTTONS")]:
    geom = scene.geometry[mesh_name]
    tm = trimesh.Trimesh(vertices=geom.vertices, faces=geom.faces, vertex_normals=geom.vertex_normals, process=False)
    new_scene.add_geometry(tm, node_name=group_name)
    print(f"{group_name}: verts={len(geom.vertices)} (без разбиения по кнопкам)")
    handled_names.add(mesh_name)

# mat_0 (COMPOUND, 52К вершин — тут же и диск режима, и куча мелких несвязанных
# деталей): вырезать DIAL по радиусу от известной точки на ИСХОДНОЙ геометрии
# (welded_components живёт в другом, сваренном индексном пространстве — сверять
# его напрямую с исходными гранями нельзя), остаток — отдельным узлом, чтобы
# ничего не потерять.
dial_mesh_name = "COMPOUND"
geom = scene.geometry[dial_mesh_name]
positions = np.asarray(geom.vertices)
normals = np.asarray(geom.vertex_normals)
faces = np.asarray(geom.faces)
face_centroids = positions[faces].mean(axis=1)

REGIONS = [("PART_DIAL", "DIAL", 0.016)]  # радиус в метрах, подобран под купол диска ~22x9мм
remaining_mask = np.ones(len(faces), dtype=bool)
for node_name, point_key, radius in REGIONS:
    mask = np.linalg.norm(face_centroids - np.array(KNOWN_POINTS[point_key]), axis=1) < radius
    mask &= remaining_mask
    used_v = np.unique(faces[mask])
    if len(used_v) < 4:
        print(f"!!! {node_name}: too few faces")
        continue
    remap = -np.ones(len(positions), dtype=np.int64)
    remap[used_v] = np.arange(len(used_v))
    sub_faces = remap[faces[mask]]
    tm = trimesh.Trimesh(vertices=positions[used_v], faces=sub_faces, vertex_normals=normals[used_v], process=False)
    new_scene.add_geometry(tm, node_name=node_name)
    print(f"{node_name}: verts={len(used_v)} faces={mask.sum()}")
    remaining_mask &= ~mask

used_v = np.unique(faces[remaining_mask])
remap = -np.ones(len(positions), dtype=np.int64)
remap[used_v] = np.arange(len(used_v))
sub_faces = remap[faces[remaining_mask]]
tm = trimesh.Trimesh(vertices=positions[used_v], faces=sub_faces, vertex_normals=normals[used_v], process=False)
new_scene.add_geometry(tm, node_name="COMPOUND_REST")
print(f"COMPOUND_REST: verts={len(used_v)} faces={remaining_mask.sum()}")
handled_names.add(dial_mesh_name)

# mat_14 (COMPOUND_15, 155x79x63мм!) — вопреки раннему (ошибочному) предположению
# это НЕ стик целиком, а огромная внутренняя оболочка/подклад грипов плюс пара
# десятков мелких отдельных детальков рельефа грипа (рёбра/бортики текстуры).
# Наш собственный numpy-сварщик (welded_components выше) оказался нестабилен на
# HD-геометрии: при допуске digits=3 склеивал несвязанные куски в один меш с
# десятками тысяч вырожденных граней ("мозаика" на рендере) — ПОЭТОМУ это
# разделение вынесено в Blender (tools/blender_split_sticks.py: Merge by
# Distance + Separate by Loose Parts, тот же принцип, но проверенная реализация,
# можно визуально сверить в самом Blender при сомнениях). Здесь только подбираем
# по ближайшему центроиду, какой из блендеровских кусков — левый/правый стик.
L3_POINT = np.array([-0.03624, -0.00065, 0.06264])
R3_POINT = np.array([0.0199, -0.0312, 0.0486])
stick_mesh_name = "COMPOUND_15"
sticks_scene = trimesh.load(STICKS_SRC, process=False)
candidates = []
for name, g in sticks_scene.geometry.items():
    pos = np.asarray(g.vertices)
    centroid = pos.mean(axis=0)
    candidates.append({"name": name, "positions": pos, "normals": np.asarray(g.vertex_normals), "faces": np.asarray(g.faces), "centroid": centroid})

# фильтр по размеру ОБЯЗАТЕЛЕН: среди блендеровских кусков есть десятки
# мелких рёбер текстуры грипа (сотни вершин) — без фильтра один из них может
# оказаться чуть ближе к R3_POINT по чистой дистанции центроида, чем настоящая
# крупная оболочка стика, и грубо исказить выбор (как и случилось при первом
# прогоне без фильтра: R3 "выиграла" деталь на 2283 вершины вместо настоящей
# оболочки на 50К+). Обе настоящие оболочки — заведомо крупные (40К+ вершин).
big_candidates = [c for c in candidates if len(c["positions"]) > 10000]
l3_pick = min(big_candidates, key=lambda c: np.linalg.norm(c["centroid"] - L3_POINT))
r3_pick = min(big_candidates, key=lambda c: np.linalg.norm(c["centroid"] - R3_POINT))
rest_parts = [c for c in candidates if c is not l3_pick and c is not r3_pick]

for label, pick in [("PART_L3", l3_pick), ("PART_R3", r3_pick)]:
    tm = trimesh.Trimesh(vertices=pick["positions"], faces=pick["faces"], vertex_normals=pick["normals"], process=False)
    new_scene.add_geometry(tm, node_name=label)
    d = np.linalg.norm(pick["centroid"] - (L3_POINT if label == "PART_L3" else R3_POINT)) * 1000
    print(f"{label}: verts={len(pick['positions'])} dist={d:.1f}mm (blender piece {pick['name']})")

# всё остальное, что Blender отделил от mat_14 (мелкий рельеф грипа), — одним
# узлом, не теряем и не красим по отдельности.
off, rp_pos, rp_faces, rp_norm = 0, [], [], []
for comp in rest_parts:
    rp_pos.append(comp["positions"])
    rp_norm.append(comp["normals"])
    rp_faces.append(comp["faces"] + off)
    off += len(comp["positions"])
tm = trimesh.Trimesh(vertices=np.concatenate(rp_pos), faces=np.concatenate(rp_faces), vertex_normals=np.concatenate(rp_norm), process=False)
new_scene.add_geometry(tm, node_name="COMPOUND_15_REST")
print(f"COMPOUND_15_REST: verts={len(tm.vertices)} (из {len(rest_parts)} мелких кусков грипа)")
handled_names.add(stick_mesh_name)

# Всё остальное переносим как есть, с переименованием известных материалов
# (body/home/dpad/shoulder) — M1/M2 и курки внутри mat_5 остаются безымянными
# (сварены с боковиной, не отделяются).
for name, geom in scene.geometry.items():
    if name in handled_names:
        continue
    mat_name = getattr(geom.visual.material, "name", None)
    node_name = {
        "mat_17": "PART_HOME",
        "mat_6": "PART_DPAD",
        "mat_9": "PART_BODY_" + name,
        "mat_5": "PART_SHOULDER_" + name,
    }.get(mat_name, name)
    tm = trimesh.Trimesh(vertices=geom.vertices, faces=geom.faces, vertex_normals=geom.vertex_normals, process=False)
    new_scene.add_geometry(tm, node_name=node_name)

new_scene.export(OUT)
print("exported", OUT)
print("nodes:", list(new_scene.geometry.keys()))
