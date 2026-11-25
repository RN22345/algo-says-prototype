"""List the PNG art that exists, so the game does not probe for missing files (no 404 lines in the console).
Run from 07_PROTOTYPE after adding or removing art:  python tools/make_have.py
Writes img/_have.json. If the file is missing, or the page is opened with ?probe=1, the game probes each file instead."""
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img")
def ids(d):
    p = os.path.join(root, d) if d else root
    return sorted(f[:-4] for f in os.listdir(p) if f.lower().endswith(".png")) if os.path.isdir(p) else []
out = {"img": ids(""), "ph": ids("ph")}
with open(os.path.join(root, "_have.json"), "w", encoding="utf8", newline="") as f:
    json.dump(out, f, indent=1)
print("img:", len(out["img"]), "ph:", len(out["ph"]))
