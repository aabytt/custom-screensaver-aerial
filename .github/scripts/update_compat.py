import os, re, csv

body = (os.environ.get("ISSUE_BODY") or "").replace("\r", "")
num = os.environ["ISSUE_NUMBER"]
remove = os.environ.get("REMOVE") == "1"
readme = "COMPATIBILITY.md"
data = "compat.csv"
cols = [
    "issue", "tv_model", "webos", "webos_full", "firmware", "aerial",
    "idle_start", "app_test", "sdr", "dolby_vision", "ui_settings",
    "status", "details",
]

fields = {
    m.group(1).strip(): m.group(2).strip()
    for m in re.finditer(r"^### (.+?)\s*\n+(.*?)(?=^### |\Z)", body, re.S | re.M)
}

def val(prefix):
    """Find a field by the start of its label (robust to small label edits)."""
    for k, v in fields.items():
        if k.lower().startswith(prefix.lower()):
            return "" if v == "_No response_" else v.replace("\n", " ").strip()
    return ""

rows = {}
if os.path.exists(data):
    with open(data, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            rows[r["issue"]] = r

rows.pop(num, None)
if not remove and val("TV Model"):
    rows[num] = {
        "issue": num,
        "tv_model": val("TV Model"),
        "webos": val("webOS major version"),
        "webos_full": val("webOS full version"),
        "firmware": val("Firmware version"),
        "aerial": val("Aerial screensaver version"),
        "idle_start": val("Screensaver starts on idle"),
        "app_test": val("Screensaver starts from the in-app test"),
        "sdr": val("SDR playback"),
        "dolby_vision": val("Dolby Vision playback"),
        "ui_settings": val("UI and settings"),
        "status": val("Status"),
        "details": val("Details"),
    }

ordered = sorted(rows.values(), key=lambda r: r["tv_model"].lower())

with open(data, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols, restval="", extrasaction="ignore")
    w.writeheader()
    w.writerows(ordered)

status_icons = {
    "Works": "✅ Works",
    "Partially works": "⚠️ Partial",
    "Not working": "❌ Not working",
}
feature_icons = {
    "Works": "✅",
    "Doesn't work": "❌",
    "Not tested": "➖",
    "Not supported by this TV": "🚫",
}

def cell(v):
    return (v or "").replace("|", "\\|")

def feat(v):
    return feature_icons.get(v, "➖" if not v else cell(v))

lines = [
    "| TV model | webOS | Firmware | Aerial | Idle | Test | SDR | DV | UI | Status | Issue |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
]
for r in ordered:
    webos = r.get("webos", "")
    if r.get("webos_full"):
        webos += " · " + r["webos_full"]
    lines.append("| " + " | ".join([
        cell(r["tv_model"]),
        cell(webos),
        cell(r.get("firmware")),
        cell(r.get("aerial")),
        feat(r.get("idle_start")),
        feat(r.get("app_test")),
        feat(r.get("sdr")),
        feat(r.get("dolby_vision")),
        feat(r.get("ui_settings")),
        status_icons.get(r.get("status"), cell(r.get("status"))),
        f"[#{r['issue']}](../../issues/{r['issue']})",
    ]) + " |")

start, end = "<!-- COMPAT:START -->", "<!-- COMPAT:END -->"
text = open(readme, encoding="utf-8").read()
text = re.sub(
    re.escape(start) + r".*?" + re.escape(end),
    lambda m: start + "\n" + "\n".join(lines) + "\n" + end,
    text, flags=re.S,
)
open(readme, "w", encoding="utf-8").write(text)
