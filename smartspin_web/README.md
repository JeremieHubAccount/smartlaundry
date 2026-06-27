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
