from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "store.json"

DEFAULT_DATA = {
    "users": {"admin": "admin"},
    "customers": [
        {"name": "Juan Dela Cruz", "phone": "0917 123 4567", "address": "San Fernando, La Union"}
    ],
    "orders": [
        {"customer": "Juan Dela Cruz", "service": "Wash & Fold", "weight": 1.0, "amount": 50, "status": "Pending", "day": "Fri"}
    ],
}


def load_data() -> dict:
    if not DATA_FILE.exists():
        save_data(DEFAULT_DATA)
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_data(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def summary(data: dict) -> dict:
    orders = data.get("orders", [])
    day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly = {day: 0 for day in day_order}
    status_counts: dict[str, int] = {}

    for order in orders:
        amount = float(order.get("amount", 0))
        day = order.get("day", "Fri")
        weekly[day] = weekly.get(day, 0) + amount
        status = order.get("status", "Pending")
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "totalCustomers": len(data.get("customers", [])),
        "totalOrders": len(orders),
        "totalRevenue": sum(float(order.get("amount", 0)) for order in orders),
        "statusCounts": status_counts,
        "weeklyRevenue": [{"label": day, "val": weekly.get(day, 0)} for day in day_order],
    }


class SmartSpinHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self.send_file(ROOT / "templates" / "index.html", "text/html; charset=utf-8")
        elif path == "/api/summary":
            self.send_json(summary(load_data()))
        elif path.startswith("/static/"):
            self.send_static(path)
        else:
            self.send_error(404, "Not found")

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        payload = self.read_json()
        data = load_data()

        if path == "/api/login":
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", "")).strip()
            if data.get("users", {}).get(username) != password:
                self.send_json({"error": "Invalid username or password."}, status=401)
                return
            self.send_json({"ok": True, "username": username})
            return

        if path == "/api/register":
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", "")).strip()
            if not username or not password:
                self.send_json({"error": "Username and password are required."}, status=400)
                return
            users = data.setdefault("users", {})
            if username in users:
                self.send_json({"error": "That username already exists."}, status=409)
                return
            users[username] = password
            save_data(data)
            self.send_json({"ok": True})
            return

        self.send_error(404, "Not found")

    def send_static(self, request_path: str) -> None:
        relative = request_path.removeprefix("/static/")
        file_path = (ROOT / "static" / relative).resolve()
        static_root = (ROOT / "static").resolve()
        if static_root not in file_path.parents and file_path != static_root:
            self.send_error(403, "Forbidden")
            return
        content_type = "text/plain; charset=utf-8"
        if file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        self.send_file(file_path, content_type)

    def send_file(self, file_path: Path, content_type: str) -> None:
        if not file_path.exists():
            self.send_error(404, "Not found")
            return
        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def send_json(self, payload: dict, status: int = 200) -> None:
        content = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format: str, *args) -> None:
        return


if __name__ == "__main__":
    load_data()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), SmartSpinHandler)
    print(f"SMARTSPIN is running at http://127.0.0.1:{port}")
    server.serve_forever()
