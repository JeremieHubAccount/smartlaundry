# SMARTSPIN Python Web App

This is the converted SMARTSPIN web version.

## Run

Open a terminal in this folder and run:

```powershell
python app.py
```

Then open:

http://127.0.0.1:8000

## Default Login

Username: `admin`  
Password: `admin`

You can also create another account from the login screen. Accounts are saved in `data/store.json`.


## Admin and Customer Login

Admin account:

```text
Username: admin
Password: admin
```

Sample customer account:

```text
Username: juan
Password: customer
```

New accounts created from the login screen are saved as customer accounts.

## Email Notifications

The app saves every notification in `data/email_outbox.json`. To send real email on Render, add these environment variables:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMARTSPIN_ADMIN_EMAIL=your-admin-email@gmail.com
```

For Gmail, use an App Password instead of your normal password.


## Create Orders

Log in as admin, open Transactions, enter the customer name, service, and weight, then click Create Order. The app saves the order and sends/saves a customer notification.


## GCash Payment QR

The GCash QR image is included at:

```text
static/images/gcash.jpg
```

It appears on the Transactions screen for admin and on the customer dashboard for customer payment instructions.


## Customer Records

Admin can add customers from the Customers screen. New registered customers and admin-added customers appear in the admin customer table. Admin-added customer accounts use the default password `customer`.


## Customer Orders and Receipts

Customers can create their own orders from Transactions. Admin can update order status from the Transactions table. Receipt opens one selected order only. Email errors are saved as `saved - email server unavailable` instead of showing raw network errors.
