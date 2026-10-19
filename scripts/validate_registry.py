#!/usr/bin/env python3
"""1-man-saas v3 registry validator + certification emitter.

Usage:
  python3 validate_registry.py <screen-registry.json> [project.json]
  python3 validate_registry.py <screen-registry.json> [project.json] --emit-cert \
      [--rounds N] [--findings findings.txt]
  python3 validate_registry.py <screen-registry.json> --guard

Modes:
  default     Full validation report. Exit 0 = pass, 1 = failures, 2 = could not run.
  --emit-cert Validate; refuse if errors; then write the certification object into the
              JSON with mechanically computed counts and print the human block to paste
              into docs/screen-registry.md. findings.txt: one finding per line; lines
              after a literal '---' line become open questions.
  --guard     Stop-hook mode. Silent exit 0 while the registry is uncertified (planning)
              or clean. Exit 2 (blocking) when a CERTIFIED registry has validation
              errors or stale certification counts. Never hand-edit certification.

The script catches broken references and stale certification, never missing screens.
The A1-A7 audit rounds (references/self-audit.md) are what make the registry foolproof;
this script is the floor.
"""
import datetime
import json
import re
import sys
from collections import Counter

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
TYPES = {"screen", "route", "library", "overlay"}
STATUSES = {"planned", "built", "verified"}
RBAC_VALUES = {"full", "read-only", "read-only-variant", "hidden"}
REQUIRED_FIELDS = [
    "id", "name", "type", "dimension", "tier", "phase", "status", "rbac",
    "purpose", "rationale", "affordances", "states",
]
PLACEHOLDER = re.compile(r"^\s*(tbd|todo|n/a|\.{3}|…)?\s*$", re.I)


def load(path):
    try:
        return json.load(open(path))
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: cannot parse {path}: {e}")
        sys.exit(2)


def computed_counts(screens):
    by_phase = Counter(s.get("phase") for s in screens)
    by_tier = Counter(s.get("tier") for s in screens)
    return {
        "total": len(screens),
        "phase1": by_phase.get(1, 0), "phase2": by_phase.get(2, 0),
        "phase3": by_phase.get(3, 0), "phase4": by_phase.get(4, 0),
        "tier1": by_tier.get(1, 0), "tier2": by_tier.get(2, 0), "tier3": by_tier.get(3, 0),
        "libraries": sum(1 for s in screens if s.get("type") == "library"),
    }


def validate(reg, project):
    errors, warnings = [], []
    screens = reg.get("screens", [])
    if not screens:
        errors.append("registry has no screens[]")
    personas = set(reg.get("personas", []))
    ids = [s.get("id", "") for s in screens]
    id_set = set(ids)

    for i, c in Counter(ids).items():
        if c > 1:
            errors.append(f"duplicate id: {i} (x{c})")

    routes = []
    for s in screens:
        sid = s.get("id", "<missing-id>")
        phase = s.get("phase")
        for f in REQUIRED_FIELDS:
            if f not in s or s[f] in (None, "", [], {}):
                if f == "affordances" and s.get(f) == []:
                    warnings.append(f"{sid}: empty affordances[] (terminal screen? confirm)")
                else:
                    errors.append(f"{sid}: missing/empty required field '{f}'")
        if not KEBAB.match(sid):
            errors.append(f"{sid}: id not kebab-case")
        if s.get("type") not in TYPES:
            errors.append(f"{sid}: type '{s.get('type')}' not in {sorted(TYPES)}")
        if s.get("type") in ("screen", "route"):
            r = s.get("route")
            if not r or not str(r).startswith("/"):
                errors.append(f"{sid}: type={s.get('type')} requires a route starting with '/'")
            else:
                routes.append((sid, r))
        if s.get("tier") not in (1, 2, 3):
            errors.append(f"{sid}: tier '{s.get('tier')}' not in 1-3")
        if phase not in (1, 2, 3, 4):
            errors.append(f"{sid}: phase '{phase}' not in 1-4")
        if s.get("status") not in STATUSES:
            errors.append(f"{sid}: status '{s.get('status')}' not in {sorted(STATUSES)}")

        rbac = s.get("rbac", {}) or {}
        for k, v in rbac.items():
            if personas and k not in personas:
                errors.append(f"{sid}: rbac persona '{k}' not in registry personas {sorted(personas)}")
            if v not in RBAC_VALUES:
                errors.append(f"{sid}: rbac value '{v}' not in {sorted(RBAC_VALUES)}")
        if personas:
            for p in personas - set(rbac):
                errors.append(f"{sid}: rbac missing persona '{p}'")

        modal_names = {m.get("name") for m in s.get("modals", []) or []}
        for a in s.get("affordances", []) or []:
            dest = a.get("dest", "")
            if dest.startswith("external:"):
                continue
            if dest.startswith("modal:"):
                if dest[len("modal:"):] not in modal_names:
                    errors.append(f"{sid}: affordance '{a.get('label')}' -> {dest} not in modals[]")
                continue
            if dest not in id_set:
                errors.append(f"{sid}: DANGLING dest '{dest}' (affordance '{a.get('label')}')")

        for v in s.get("variants", []) or []:
            if v not in id_set:
                errors.append(f"{sid}: variants[] entry '{v}' not a registry id")

        # Depth floor: P1/P2 screens carry real data_deps and cc_notes (max-depth rule)
        if phase in (1, 2) and s.get("type") == "screen":
            dd = s.get("data_deps") or {}
            if not (dd.get("tables") or dd.get("queries") or dd.get("mutations")):
                warnings.append(f"{sid}: P{phase} screen with empty data_deps (max-depth rule)")
            cc = str(s.get("cc_notes", "") or "")
            if PLACEHOLDER.match(cc) or cc.lower().startswith("deferred"):
                warnings.append(f"{sid}: P{phase} screen cc_notes placeholder/deferred (max-depth rule)")

    for r, c in Counter(rt for _, rt in routes).items():
        if c > 1:
            dupes = [sid for sid, rt in routes if rt == r]
            errors.append(f"duplicate route '{r}': {dupes}")

    cert = reg.get("certification", {}) or {}
    if cert.get("status") == "certified":
        if cert.get("dangling_destinations", 1) != 0:
            errors.append("certification claims certified but dangling_destinations != 0")
        if any("DANGLING" in e for e in errors):
            errors.append("certification claims certified but validator found dangling dests: re-audit")
        stored, actual = cert.get("counts", {}), computed_counts(screens)
        stale = {k: (stored.get(k), actual[k]) for k in actual if stored.get(k) != actual[k]}
        if stale:
            errors.append(f"STALE certification counts (stored vs actual): {stale}: re-run --emit-cert")

    if project:
        proj_personas = {p.get("id") for p in project.get("personas", [])}
        if personas != proj_personas:
            errors.append(f"personas mismatch: registry {sorted(personas)} vs project.json {sorted(proj_personas)}")
        m1 = {s["id"] for s in screens if s.get("phase") == 1}
        m2 = {s["id"] for s in screens if s.get("phase") == 2}
        covered_m1, covered_any = set(), set()
        for sess in project.get("sessions", []):
            for scr in sess.get("screens", []):
                if scr not in id_set:
                    errors.append(f"session {sess.get('id')}: screens[] id '{scr}' not in registry")
                else:
                    covered_any.add(scr)
                    if sess.get("milestone") == "M1":
                        covered_m1.add(scr)
        for miss in sorted(m1 - covered_m1):
            errors.append(f"Phase 1 screen '{miss}' not covered by any M1 session")
        for miss in sorted(m2 - covered_any):
            errors.append(f"Phase 2 screen '{miss}' not covered by any session")

    return errors, warnings


def emit_cert(reg_path, reg, errors, rounds, findings_path):
    # The old certification is being replaced, so its own staleness/claims are not blockers
    errors = [e for e in errors
              if not e.startswith("STALE certification") and not e.startswith("certification claims")]
    if errors:
        print("REFUSED: cannot certify a registry with validation errors:")
        for e in errors:
            print(f"  ERROR {e}")
        return 1
    findings, open_qs, past = [], [], False
    if findings_path:
        for line in open(findings_path).read().splitlines():
            line = line.strip()
            if line == "---":
                past = True
            elif line:
                (open_qs if past else findings).append(line)
    counts = computed_counts(reg.get("screens", []))
    cert = {
        "status": "certified",
        "audited": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "frameworks_applied": ["F1", "F2", "F3", "F4", "F5"],
        "audit_rounds": rounds,
        "counts": counts,
        "dangling_destinations": 0,
        "findings_fixed": findings,
        "open_questions": open_qs,
    }
    reg["certification"] = cert
    json.dump(reg, open(reg_path, "w"), indent=2)
    print(f"certification written into {reg_path}\n")
    print("Paste into docs/screen-registry.md (certification section):\n")
    print("```")
    print("CERTIFICATION | status: certified")
    print(f"Audited: {cert['audited']} · Frameworks: F1-F5 forward + A1-A7 reverse · Rounds: {rounds}")
    print(f"Counts: {counts['total']} screens ({counts['phase1']}/{counts['phase2']}/"
          f"{counts['phase3']}/{counts['phase4']} by phase · {counts['tier1']}/{counts['tier2']}/"
          f"{counts['tier3']} by tier · {counts['libraries']} libraries)")
    print("Dangling destinations: 0 · Unresolved RBAC: 0 · Phase-gate simulations: M1 pass, M2 pass")
    print(f"Findings fixed ({len(findings)}):")
    for f in findings:
        print(f"  - {f}")
    print(f"Open questions ({len(open_qs)}):")
    for q in open_qs:
        print(f"  - {q}")
    print("```")
    return 0


def main() -> int:
    args = [a for a in sys.argv[1:]]
    guard = "--guard" in args
    do_cert = "--emit-cert" in args
    rounds = 1
    findings_path = None
    if "--rounds" in args:
        rounds = int(args[args.index("--rounds") + 1])
    if "--findings" in args:
        findings_path = args[args.index("--findings") + 1]
    paths = [a for a in args if not a.startswith("--")
             and a != (findings_path or "") and a != str(rounds)]
    if not paths:
        print(__doc__)
        return 0 if guard else 2

    reg_path = paths[0]
    try:
        reg = json.load(open(reg_path))
    except FileNotFoundError:
        return 0 if guard else (print(f"FAIL: {reg_path} not found") or 2)
    except Exception as e:  # noqa: BLE001
        if guard:
            print(f"BLOCKED: {reg_path} is not valid JSON: {e}", file=sys.stderr)
            return 2
        print(f"FAIL: cannot parse {reg_path}: {e}")
        return 2
    project = load(paths[1]) if len(paths) > 1 else None

    errors, warnings = validate(reg, project)

    if do_cert:
        return emit_cert(reg_path, reg, errors, rounds, findings_path)

    if guard:
        if (reg.get("certification", {}) or {}).get("status") != "certified":
            return 0
        if errors:
            print("BLOCKED by registry guard: certified registry fails validation. "
                  f"First errors: {'; '.join(errors[:3])}. Fix the registry (or re-run "
                  "scripts/validate_registry.py --emit-cert after a legitimate change), then retry.",
                  file=sys.stderr)
            return 2
        return 0

    screens = reg.get("screens", [])
    by_phase = Counter(s.get("phase") for s in screens)
    print(f"screens: {len(screens)} | by phase: "
          + ", ".join(f"P{p}:{by_phase.get(p, 0)}" for p in (1, 2, 3, 4)))
    for w in warnings:
        print(f"WARN  {w}")
    if errors:
        for e in errors:
            print(f"ERROR {e}")
        print(f"\nFAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASS: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
