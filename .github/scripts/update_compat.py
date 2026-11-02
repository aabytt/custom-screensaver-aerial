import os, re, csv

body = (os.environ.get("ISSUE_BODY") or "").replace("\r", "")
num = os.environ["ISSUE_NUMBER"]
remove = os.environ.get("REMOVE") == "1"
readme = "COMPATIBILITY.md"
data = "compat.csv"
cols = ["issue", "tv_model", "webos", "webos_full", "firmware", "aerial", "status", "details"]

fields = {
    m.group(1).strip(): m.group(2).strip()
    for m in re.finditer(r"^### (.+?)\s*\n+(.*?)(?=^### |\Z)", body, re.S | re.M)
}

def val(k):
    v = fields.get(k, "")
    return "" if v == "_No response_" else v.replace("\n", " ").strip()

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
        "webos": val("webOS version"),
        "webos_full": val("webOS full version"),
        "firmware": val("Firmware version"),
        "aerial": val("Aerial screensaver version"),
        "status": val("Status"),
        "details": val("Details"),
    }

ordered = sorted(rows.values(), key=lambda r: r["tv_model"].lower())

with open(data, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(ordered)

icons = {
    "Works": "✅ Works",
    "Partially works": "⚠️ Partial",
    "Not working": "❌ Not working",
}

def cell(v):
    return v.replace("|", "\\|")

lines = [
    "| TV model | webOS | Firmware | Aerial | Status | Details | Issue |",
    "|---|---|---|---|---|---|---|",
]
for r in ordered:
    lines.append("| " + " | ".join([
        cell(r["tv_model"]), cell(r["webos"] + (" · " + r.get("webos_full", "") if r.get("webos_full") else "")), cell(r["firmware"]),
        cell(r["aerial"]), icons.get(r["status"], cell(r["status"])),
        cell(r["details"][:80] + ("…" if len(r["details"]) > 80 else "")), f"[#{r['issue']}](../../issues/{r['issue']})",
    ]) + " |")

start, end = "<!-- COMPAT:START -->", "<!-- COMPAT:END -->"
text = open(readme, encoding="utf-8").read()
text = re.sub(
    re.escape(start) + r".*?" + re.escape(end),
    lambda m: start + "\n" + "\n".join(lines) + "\n" + end,
    text, flags=re.S,
)
open(readme, "w", encoding="utf-8").write(text)
