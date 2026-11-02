# Headless Blender-скрипт: чистое разделение mat_14 (COMPOUND_15 — гигантский
# меш 155x79x63мм, внутри которого спрятаны детали обоих стиков) на связные
# куски через Merge by Distance + Separate by Loose Parts. Нужен именно
# Blender, а не наш ручной numpy/trimesh-сварщик (tools/split_gamepad_parts.py,
# функция welded_components) — тот же алгоритм "сварить+найти компоненты",
# но от допуска сварки (digits_vertex) результат нестабилен и при повышении
# детализации STEP-конвертации (HD-пересборка) с digits=3 давал мусорную
# геометрию (сотни тысяч вырожденных граней на 1000 вершин). Blender использует
# тот же принцип, но даёт визуально проверить результат в GUI при необходимости.
#
# Запуск:
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python tools/blender_split_sticks.py

import bpy
import sys

SRC = r"C:\gamepads\docs\assets\g6\g6_hd.glb"
OUT = r"C:\gamepads\docs\assets\g6\g6_sticks_split.glb"
MERGE_THRESHOLD = 0.00001  # 0.01мм — соответствует digits_vertex=5, дал чистую (ratio~2) геометрию в тестах trimesh

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

target = None
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    mats = [s.material.name for s in obj.material_slots if s.material]
    if any("mat_14" in m for m in mats):
        target = obj
        break

if target is None:
    print("!!! mat_14 object not found, available objects:")
    for obj in bpy.context.scene.objects:
        print("  ", obj.name, [s.material.name for s in obj.material_slots if s.material])
    sys.exit(1)

print("found target:", target.name, "verts:", len(target.data.vertices))

# изолируем только нужный объект в сцене, всё остальное удаляем — экспортируем
# только результат разделения стиков, остальное уже корректно собирает
# tools/split_gamepad_parts.py напрямую из g6_hd.glb.
for obj in list(bpy.context.scene.objects):
    if obj is not target:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.context.view_layer.objects.active = target
target.select_set(True)

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=MERGE_THRESHOLD)
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

pieces = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print("loose parts after separate:", len(pieces))
for o in pieces:
    bb = [o.matrix_world @ v.co for v in o.data.vertices[:1]]  # cheap sanity check only
    print("  ", o.name, "verts:", len(o.data.vertices), "faces:", len(o.data.polygons))

# пересчитать нормали (на случай плоских/перевёрнутых участков после сварки)
# и гладкая заливка — убирает "мозаику" тон-шейдинга на изогнутых поверхностях.
for o in pieces:
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print("exported", OUT)
