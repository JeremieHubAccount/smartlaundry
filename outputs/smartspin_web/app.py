from __future__ import annotations

import json
import os
import smtplib
import socket
from datetime import datetime
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

print("=== APP.PY VERSION 2 LOADED ===")

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "store.json"
OUTBOX_FILE = ROOT / "data" / "email_outbox.json"

DEFAULT_DATA = {
    "users": {
        "admin": {
            "password": "admin",
            "role": "admin",
            "email": os.environ.get("SMARTSPIN_ADMIN_EMAIL", "admin@smartspin.local"),
            "name": "SMARTSPIN Admin",
        },
        "juan": {"password": "customer", "role": "customer", "email": "juan@example.com", "name": "Juan Dela Cruz"},
    },
    "customers": [
        {"username": "juan", "name": "Juan Dela Cruz", "email": "juan@example.com", "phone": "0917 123 4567", "address": "San Fernando, La Union"}
    ],
    "orders": [
        {"id": 1, "customer": "Juan Dela Cruz", "username": "juan", "service": "Wash & Fold", "weight": 1.0, "amount": 50, "status": "Pending", "day": "Fri"}
    ],
}


def normalize_user(username: str, value) -> dict:
    if isinstance(value, dict):
        return {
            "password": str(value.get("password", "")),
            "role": value.get("role", "customer"),
            "email": value.get("email", ""),
            "name": value.get("name", username),
        }
    return {"password": str(value), "role": "admin" if username == "admin" else "customer", "email": "", "name": username}


def load_data() -> dict:
    if not DATA_FILE.exists():
        save_data(DEFAULT_DATA)
    with DATA_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    users = data.setdefault("users", {})
    data["users"] = {username: normalize_user(username, value) for username, value in users.items()}
    if "admin" not in data["users"]:
        data["users"]["admin"] = DEFAULT_DATA["users"]["admin"]

    data.setdefault("customers", [])
    data.setdefault("orders", [])
    for index, order in enumerate(data["orders"], start=1):
        order.setdefault("id", index)
        order.setdefault("status", "Pending")
        if not order.get("username"):
            customer = find_customer(data, order.get("customer", ""))
            if customer:
                order["username"] = customer.get("username", "")
    save_data(data)
    return data


def save_data(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def load_outbox() -> list[dict]:
    if not OUTBOX_FILE.exists():
        return []
    with OUTBOX_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_outbox(items: list[dict]) -> None:
    OUTBOX_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTBOX_FILE.open("w", encoding="utf-8") as file:
        json.dump(items, file, indent=2)


def send_notification(to_email: str, subject: str, body: str, kind: str = "info") -> dict:
    item = {
        "to": to_email or "not-provided",
        "subject": subject,
        "body": body,
        "kind": kind,
        "createdAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "sent": False,
        "status": "saved",
    }

    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    sender = os.environ.get("SMTP_FROM", user or "no-reply@smartspin.local")
    port = int(os.environ.get("SMTP_PORT", "587"))

    print("host =", repr(host))
    print("user =", repr(user))
    print("password =", repr(password))
    print("to_email =", repr(to_email))

    print("host bool =", bool(host))
    print("user bool =", bool(user))
    print("password bool =", bool(password))
    print("to_email bool =", bool(to_email))

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(body)

    print("SMTP_HOST:", repr(host))
    print("SMTP_PORT:", repr(port))
    print("SMTP_USER:", repr(user))
    print("SMTP_PASS exists:", password is not None)
    print("SMTP_FROM:", repr(sender))

    if host and user and password and to_email:
        print("SMTP_HOST =", host)
        print("SMTP_PORT =", port)
        print("SMTP_USER =", user)

        try:
            print("DNS =", socket.gethostbyname(host))
        except Exception as e:
            print("DNS ERROR:", repr(e))
        
        try:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                smtp.starttls()
                smtp.login(user, password)
                smtp.send_message(msg)
            item["sent"] = True
            item["status"] = "sent"
        except Exception as e:
            print("EMAIL ERROR:", repr(e))
            item["status"] = f"EMAIL ERROR: {e}"

    outbox = load_outbox()
    outbox.insert(0, item)
    save_outbox(outbox[:100])
    return item


def find_customer(data: dict, name_or_username: str) -> dict | None:
    target = name_or_username.strip().lower()
    for customer in data.get("customers", []):
        if customer.get("username", "").lower() == target or customer.get("name", "").lower() == target:
            return customer
    return None


def find_order(data: dict, order_id: int) -> dict | None:
    for order in data.get("orders", []):
        if int(order.get("id", 0)) == order_id:
            return order
    return None


def next_order_id(data: dict) -> int:
    ids = [int(order.get("id", 0)) for order in data.get("orders", [])]
    return max(ids or [0]) + 1


def order_amount(service: str, weight: float) -> float:
    rates = {"Wash & Fold": 50, "Wash & Dry": 65, "Dry Clean": 120, "Iron Only": 35}
    return round(rates.get(service, 50) * max(weight, 1), 2)


def orders_for_user(data: dict, username: str | None, role: str) -> list[dict]:
    orders = data.get("orders", [])
    if role == "admin":
        return orders
    return [order for order in orders if order.get("username") == username]


def summary(data: dict, username: str | None = None, role: str = "admin") -> dict:
    orders = orders_for_user(data, username, role)
    day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly = {day: 0 for day in day_order}
    status_counts: dict[str, int] = {}
    for order in orders:
        amount = float(order.get("amount", 0))
        day = order.get("day", "Fri")
        weekly[day] = weekly.get(day, 0) + amount
        status = order.get("status", "Pending")
        status_counts[status] = status_counts.get(status, 0) + 1
    customer_total = len(data.get("customers", [])) if role == "admin" else 1
    return {
        "totalCustomers": customer_total,
        "totalOrders": len(orders),
        "totalRevenue": sum(float(order.get("amount", 0)) for order in orders),
        "statusCounts": status_counts,
        "weeklyRevenue": [{"label": day, "val": weekly.get(day, 0)} for day in day_order],
        "orders": orders,
    }


class SmartSpinHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        data = load_data()
        if path == "/":
            self.send_file(ROOT / "templates" / "index.html", "text/html; charset=utf-8")
        elif path == "/api/summary":
            username = (params.get("username") or [None])[0]
            user = data.get("users", {}).get(username or "", {})
            role = user.get("role", "admin" if not username else "customer")
            self.send_json(summary(data, username, role))
        elif path == "/api/customers":
            self.send_json({"customers": data.get("customers", [])})
        elif path == "/api/notifications":
            self.send_json({"notifications": load_outbox()[:25]})
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
            user = data.get("users", {}).get(username)
            if not user or user.get("password") != password:
                self.send_json({"error": "Invalid username or password."}, status=401)
                return
            self.send_json({"ok": True, "username": username, "role": user.get("role", "customer"), "email": user.get("email", ""), "name": user.get("name", username)})
            return

        if path == "/api/register":
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", "")).strip()
            email = str(payload.get("email", "")).strip()
            if not username or not password:
                self.send_json({"error": "Username and password are required."}, status=400)
                return
            users = data.setdefault("users", {})
            if username in users:
                self.send_json({"error": "That username already exists."}, status=409)
                return
            users[username] = {"password": password, "role": "customer", "email": email, "name": username}
            data.setdefault("customers", []).append({"username": username, "name": username, "email": email, "phone": "", "address": ""})
            save_data(data)
            send_notification(email, "Welcome to SMARTSPIN", "Your SMARTSPIN customer account has been created.", "welcome")
            admin_email = os.environ.get("SMARTSPIN_ADMIN_EMAIL", data["users"].get("admin", {}).get("email", ""))
            send_notification(admin_email, "New SMARTSPIN customer", f"New customer registered: {username}", "admin")
            self.send_json({"ok": True})
            return

        if path == "/api/customers":
            name = str(payload.get("name", "")).strip()
            phone = str(payload.get("phone", "")).strip()
            address = str(payload.get("address", "")).strip()
            email = str(payload.get("email", "")).strip()
            if not name:
                self.send_json({"error": "Customer name is required."}, status=400)
                return
            username = str(payload.get("username", "")).strip() or name.lower().replace(" ", "_")
            customer = {"username": username, "name": name, "email": email, "phone": phone, "address": address}
            data.setdefault("customers", []).append(customer)
            users = data.setdefault("users", {})
            if username not in users:
                users[username] = {"password": "customer", "role": "customer", "email": email, "name": name}
            save_data(data)
            send_notification(email, "Welcome to SMARTSPIN", "Your SMARTSPIN customer profile has been created.", "customer")
            admin_email = os.environ.get("SMARTSPIN_ADMIN_EMAIL", data["users"].get("admin", {}).get("email", ""))
            send_notification(admin_email, "New SMARTSPIN customer", f"Customer added: {name}", "admin")
            self.send_json({"ok": True, "customer": customer})
            return

        if path == "/api/orders":
            requester = str(payload.get("username", "")).strip()
            role = str(payload.get("role", "customer")).strip()
            service = str(payload.get("service", "Wash & Fold")).strip()
            status = "Pending"
            try:
                weight = float(payload.get("weight", 1))
            except (TypeError, ValueError):
                weight = 1.0
            if weight <= 0:
                self.send_json({"error": "Weight must be greater than zero."}, status=400)
                return

            if role == "customer":
                user = data.get("users", {}).get(requester, {})
                customer = find_customer(data, requester)
                if not customer:
                    customer = {"username": requester, "name": user.get("name", requester), "email": user.get("email", ""), "phone": "", "address": ""}
                    data.setdefault("customers", []).append(customer)
            else:
                customer_name = str(payload.get("customer", "")).strip()
                if not customer_name:
                    self.send_json({"error": "Customer name is required."}, status=400)
                    return
                customer = find_customer(data, customer_name)
                if not customer:
                    username = customer_name.lower().replace(" ", "_")
                    customer = {"username": username, "name": customer_name, "email": "", "phone": "", "address": ""}
                    data.setdefault("customers", []).append(customer)

            amount = order_amount(service, weight)
            order = {
                "id": next_order_id(data),
                "customer": customer.get("name", requester),
                "username": customer.get("username", requester),
                "service": service,
                "weight": weight,
                "amount": amount,
                "status": status,
                "day": datetime.now().strftime("%a"),
            }
            data.setdefault("orders", []).append(order)
            save_data(data)
            send_notification(customer.get("email", ""), "SMARTSPIN order created", f"Your {service} order has been created. Weight: {weight} kg. Amount: PHP {amount:.2f}. Status: {status}.", "order")
            admin_email = os.environ.get("SMARTSPIN_ADMIN_EMAIL", data["users"].get("admin", {}).get("email", ""))
            send_notification(admin_email, "New SMARTSPIN order", f"New order for {order['customer']}: {service}, {weight} kg, PHP {amount:.2f}.", "admin-order")
            self.send_json({"ok": True, "order": order})
            return

        if path == "/api/orders/status":
            try:
                order_id = int(payload.get("id", 0))
            except (TypeError, ValueError):
                order_id = 0
            new_status = str(payload.get("status", "")).strip()
            allowed = {"Pending", "Washing", "Drying", "Ready", "Delivered"}
            if new_status not in allowed:
                self.send_json({"error": "Invalid order status."}, status=400)
                return
            order = find_order(data, order_id)
            if not order:
                self.send_json({"error": "Order not found."}, status=404)
                return
            order["status"] = new_status
            save_data(data)
            customer = find_customer(data, order.get("username", "")) or find_customer(data, order.get("customer", "")) or {}
            send_notification(customer.get("email", ""), "SMARTSPIN order status updated", f"Your order #{order_id} is now {new_status}.", "status")
            self.send_json({"ok": True, "order": order})
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
        elif file_path.suffix in {".jpg", ".jpeg"}:
            content_type = "image/jpeg"
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
