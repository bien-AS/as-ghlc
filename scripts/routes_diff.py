#!/usr/bin/env python3
"""1-man-saas v3 routes-vs-registry diff.

Usage:
  python3 routes_diff.py [--registry screen-registry.json] [--app-dir app] [--guard]

Enumerates actual Next.js App Router routes (page.* files; route.* handlers noted
separately) and diffs them against the screen registry. Route groups "(name)" and
parallel slots "@name" are stripped on BOTH sides before comparison, so
"/(dashboard)/settings" and "/settings" match. Dynamic segments compare literally
("[id]" to "[id]").

Reports four lists:
  1. BUILT BUT UNREGISTERED   page routes with no registry entry (protocol violation:
                              the fix is to register with full fields, never to delete)
  2. REGISTERED, NOT BUILT    registry screens with no page yet, grouped by phase
                              (informational before a milestone, fail at its gate);
                              a matching route.* handler is flagged handler-only
  3. STATUS DRIFT             built page exists but registry status is still 'planned'
  4. API SURFACE              app/api/* handlers (informational)

Exit codes: default mode 1 if list 1 is non-empty, else 0.
--guard (Stop hook): silent exit 0 unless list 1 is non-empty (or the registry is
unparseable), then a short stderr reason and exit 2 (blocking). Missing registry or
app dir exits 0 quietly in guard mode (pre-scaffold stages).
"""
import json
import os
import re
import sys

PAGE = re.compile(r"^page\.(tsx|jsx|ts|js)$")
HANDLER = re.compile(r"^route\.(tsx|ts|js)$")
# Next.js special files that satisfy a registry route without a page.tsx
# (the error-state library's 404/403 routes are typically registered this way)
SPECIAL = re.compile(r"^(not-found|forbidden|unauthorized)\.(tsx|jsx|ts|js)$")


def normalize(route: str) -> str:
    parts = [p for p in route.split("/") if p]
    parts = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]
    parts = [p for p in parts if not p.startswith("@")]
    return "/" + "/".join(parts) if parts else "/"


def scan_app(app_dir):
    pages, handlers = set(), set()
    for dirpath, dirnames, filenames in os.walk(app_dir):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".next")]
        rel = os.path.relpath(dirpath, app_dir)
        route = "/" if rel == "." else "/" + rel.replace(os.sep, "/")
        for f in filenames:
            if PAGE.match(f):
                pages.add(normalize(route))
            elif HANDLER.match(f):
                handlers.add(normalize(route))
            else:
                m = SPECIAL.match(f)
                if m:
                    base = normalize(route)
                    pages.add(("" if base == "/" else base) + "/" + m.group(1))
    return pages, handlers


def main() -> int:
    args = sys.argv[1:]
    guard = "--guard" in args

    reg_path = "screen-registry.json"
    if "--registry" in args:
        reg_path = args[args.index("--registry") + 1]
    app_dir = None
    if "--app-dir" in args:
        app_dir = args[args.index("--app-dir") + 1]
    else:
        for cand in ("app", "src/app"):
            if os.path.isdir(cand):
                app_dir = cand
                break

    if not os.path.isfile(reg_path) or app_dir is None:
        if guard:
            return 0
        print(f"note: registry ({reg_path}) or app dir not found; nothing to diff (pre-scaffold?)")
        return 0

    try:
        reg = json.load(open(reg_path))
    except Exception as e:  # noqa: BLE001
        if guard:
            print(f"BLOCKED: {reg_path} is not valid JSON: {e}", file=sys.stderr)
            return 2
        print(f"FAIL: cannot parse {reg_path}: {e}")
        return 2

    pages, handlers = scan_app(app_dir)
    api = sorted(r for r in handlers if r == "/api" or r.startswith("/api/"))
    handlers -= set(api)

    reg_routes = {}  # normalized route -> screen (type screen = expects a page; type route = expects a handler)
    for s in reg.get("screens", []):
        r = s.get("route")
        if s.get("type") in ("screen", "route") and r:
            reg_routes[normalize(r)] = s

    built = {r: s for r, s in reg_routes.items() if r in pages or r in handlers}
    # /dev/* pages are development-only tools (they 404 in production), not screens.
    unregistered = sorted(r for r in pages - set(reg_routes) if not r.startswith("/dev/"))
    not_built = [(r, s) for r, s in sorted(reg_routes.items()) if r not in built]
    drift = [(r, s) for r, s in sorted(built.items()) if s.get("status") == "planned"]

    if guard:
        if unregistered:
            print("BLOCKED by registry guard: built-but-unregistered route(s): "
                  + ", ".join(unregistered[:5])
                  + ". Register each in screen-registry.json (full fields, then "
                  "scripts/validate_registry.py --emit-cert) before ending the turn.",
                  file=sys.stderr)
            return 2
        return 0

    print(f"app dir: {app_dir} | pages: {len(pages)} | registry screen routes: {len(reg_routes)}")
    print(f"\n1. BUILT BUT UNREGISTERED ({len(unregistered)}) [FAIL if any]")
    for r in unregistered:
        print(f"   {r}")
    print(f"\n2. REGISTERED, NOT BUILT ({len(not_built)})")
    for r, s in not_built:
        print(f"   P{s.get('phase')} {s.get('status'):8} {s.get('id'):32} {r}")
    honly = [(r, s) for r, s in sorted(built.items())
             if s.get("type") == "screen" and r not in pages]
    if honly:
        print(f"\n   handler-only but registered type=screen ({len(honly)}) [verify: should these be type=route?]")
        for r, s in honly:
            print(f"   {s.get('id'):32} {r}")
    print(f"\n3. STATUS DRIFT: page exists, status still 'planned' ({len(drift)})")
    for r, s in drift:
        print(f"   {s.get('id'):32} {r}  -> advance to 'built' (or 'verified' after tests)")
    print(f"\n4. API SURFACE ({len(api)} handler routes, informational)")
    for r in api:
        print(f"   {r}")
    verdict = "FAIL (unregistered routes)" if unregistered else "PASS"
    print(f"\n{verdict}")
    return 1 if unregistered else 0


if __name__ == "__main__":
    sys.exit(main())
