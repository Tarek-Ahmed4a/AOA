"""
Headless Blender Python Exporter for Z-Anatomy .blend Projects
---------------------------------------------------------------
Usage:
  blender --background Z-Anatomy.blend --python scripts/export_zanatomy_blender.py -- \
    --out-dir public/models/zanatomy

Exports the top-level anatomical system collections cleanly into individual .glb files
while preserving each collection's shared world origin (0, 0, 0), native PBR materials,
and Blender mesh object names.
"""

import os
import sys
import bpy

SYSTEM_COLLECTION_MAP = {
    "skeletal": ["Skeletal", "SkeletalSystem", "Skeleton", "Bones", "Joints"],
    "muscular": ["Muscular", "MuscularSystem", "Muscles"],
    "visceral": ["Visceral", "VisceralSystem", "Splanchnology", "Lymphoid", "Organs"],
    "cardiovascular": ["Cardiovascular", "CardioVascular", "Heart", "Vessels"],
    "nervous": ["Nervous", "NervousSystem", "Brain", "Nerves"],
    "integumentary": ["Integumentary", "Regions", "Skin", "BodyRegions"],
}

HELPER_SUFFIXES = (".j", ".i", ".t", ".s", ".g")


def is_helper_object(obj):
    if obj.type != "MESH":
        return True
    name_lower = obj.name.lower()
    if any(name_lower.endswith(suf) for suf in HELPER_SUFFIXES):
        return True
    if name_lower.startswith(("text", "cross_section", "line")):
        return True
    return False


def match_collection_to_system(col_name):
    lower = col_name.lower()
    for system_key, aliases in SYSTEM_COLLECTION_MAP.items():
        if any(alias.lower() in lower for alias in aliases):
            return system_key
    return None


def collect_meshes_recursive(collection, seen):
    result = []
    for obj in collection.objects:
        if obj.name not in seen and not is_helper_object(obj):
            seen.add(obj.name)
            result.append(obj)
    for child in collection.children:
        result.extend(collect_meshes_recursive(child, seen))
    return result


def main():
    argv = sys.argv
    out_dir = os.path.join("public", "models", "zanatomy")
    if "--" in argv:
        extra = argv[argv.index("--") + 1 :]
        if "--out-dir" in extra:
            idx = extra.index("--out-dir")
            if idx + 1 < len(extra):
                out_dir = extra[idx + 1]

    os.makedirs(out_dir, exist_ok=True)

    grouped_objects = {k: [] for k in SYSTEM_COLLECTION_MAP}
    seen_per_system = {k: set() for k in SYSTEM_COLLECTION_MAP}

    for col in bpy.data.collections:
        sys_key = match_collection_to_system(col.name)
        if not sys_key:
            continue
        objs = collect_meshes_recursive(col, seen_per_system[sys_key])
        grouped_objects[sys_key].extend(objs)

    for sys_key, objs in grouped_objects.items():
        if not objs:
            continue

        bpy.ops.object.select_all(action="DESELECT")
        for obj in objs:
            obj.hide_set(False)
            obj.hide_viewport = False
            obj.select_set(True)

        out_path = os.path.abspath(os.path.join(out_dir, f"{sys_key}.glb"))
        print(f"[Z-Anatomy Blender Export] Exporting {len(objs)} meshes -> {out_path}")
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_materials="EXPORT",
        )


if __name__ == "__main__":
    main()
