# National Commercial Bank Jamaica Medical Platform

A self-contained secure intake app for new-hire medical assessments. Clinicians complete the medical form in the browser, submit it into the platform, and reviewers receive a notification that a confidential form is ready to review.

## Run locally

```bash
node server.js
```

Open [http://localhost:8080](http://localhost:8080).

On first run the app creates encrypted storage under `data/` and writes temporary local credentials to `data/bootstrap-credentials.txt`.

Optional PostgreSQL, MySQL, and Google Cloud SQL connectors and automatic migrations are documented in [DATABASE.md](DATABASE.md). Database mode currently prepares and validates the SQL schema while the application continues using its encrypted file repositories pending the controlled repository cutover.

## Run with Docker

Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD`. For local Docker, the app container overrides the host-specific database settings so it connects to `ncb-medical-postgres` on the Docker network. The `./data` folder is mounted into the app container at `/app/data`, keeping generated credentials, encrypted records, audit logs, and notification logs outside the image.

Start Postgres only:

```bash
docker compose up -d ncb-medical-postgres
docker compose exec ncb-medical-postgres pg_isready
```

Start the app and Postgres:

```bash
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080).

View logs:

```bash
docker compose logs -f ncb-medical-app
```

## What is included

- Clinician and reviewer sign-in with PBKDF2 password hashing.
- HttpOnly, SameSite session cookies with CSRF protection.
- Role-based access: clinicians submit records, reviewers review records.
- Administrator site for portal wording, notification recipients, and user access.
- Reviewer setup area for creating doctor accounts and assigned new-hire profiles.
- Doctor-side assigned-candidate picker that auto-populates the candidate section.
- Doctor profile defaults for medical facility, facility address, clinician name, and registration number.
- Optional clinician signature image upload on medical submissions.
- Candidate medication information editing and assigned-candidate withdrawal.
- Monthly tracking of assigned candidates and submitted forms by doctor.
- Forgot-password request flow that logs a reset request without exposing account details.
- Separate reviewer submission notification and doctor assignment notification email settings.
- AES-256-GCM encryption at rest for submitted medical forms.
- No medical details in email notifications.
- Local notification logging when SMTP is not configured.
- Printable populated form view for authorized users.
- Audit log without candidate medical details.

## Email notifications

Copy `.env.example` to `.env` and set:

```bash
REVIEW_NOTIFICATION_EMAIL=hr-team@example.com
FROM_EMAIL=no-reply@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASS=your-password
PUBLIC_URL=https://your-secure-platform.example.com
```

The email body intentionally includes only the submission ID and platform link.

## Add or update a user

```bash
node scripts/upsert-user.js user@example.com "temporary-password" reviewer "Display Name"
```

Allowed roles are `clinician`, `reviewer`, and `admin`. Restart the app after changing users.

## Administrator site

Admins see an **Administration** page after sign-in. From there they can:

- Update the doctor and reviewer page messages, confidentiality notice, NCB blue/yellow theme colors, support contact, and reviewer notification email list.
- Create medical facility users, National Commercial Bank reviewers, and additional administrators.
- Deactivate users, change roles, and reset passwords.

Reviewers and admins also see **Doctor & new hire setup**. From there they can create doctor accounts with facility and registration defaults, enter new-hire candidate information, assign each candidate to a doctor, set notification email preferences, and track monthly candidate volumes by doctor.

For this workspace, an admin account can be created or updated with:

```bash
node scripts/upsert-user.js admin@ncb.local "change-this-password" admin "System Administrator"
```

## Production checklist

Before using this with real medical data:

- Serve only over HTTPS and set `COOKIE_SECURE=true`.
- Store `APP_MASTER_KEY` in a managed secret vault, not in the project folder.
- Replace local users with your organization's identity provider or enforce user lifecycle controls.
- Restrict access by facility, reviewer group, and network policy where appropriate.
- Add secure backups, restore testing, retention rules, and deletion workflows.
- Complete legal/privacy review for applicable health-data and employment regulations.
- Run security testing before handling live records.

## Customizing the exact medical form

The current form is a practical structured version of the NCB medical assessment for secure browser completion. If the paper form is revised, update the visible fields in `public/app.js` and the matching validation fields in `server.js`.
# NCB-New-Hire
