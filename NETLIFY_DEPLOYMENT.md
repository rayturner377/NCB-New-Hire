# Netlify Deployment Guide

## Current Status

The Netlify project has been created:

```text
ncb-medical-platform
```

Project dashboard:

```text
https://app.netlify.com/projects/ncb-medical-platform
```

However, the site will not load until the code is uploaded or connected from GitHub.

## Why The Link Does Not Work Yet

The project exists on Netlify, but there is no deployed build. Netlify shows an empty project until code is connected and deployed.

## Recommended Deployment Method: GitHub

1. Create a GitHub repository.
2. Upload the project files so this file is at the root:

```text
package.json
```

The root of the repository should look like:

```text
package.json
netlify.toml
server.js
public/
netlify/
scripts/
README.md
ARCHITECTURE.md
```

3. In Netlify, open:

```text
https://app.netlify.com/projects/ncb-medical-platform
```

4. Connect the GitHub repository.

5. Use these build settings:

```text
Base directory: leave blank
Build command: echo 'No frontend build required'
Publish directory: public
Functions directory: netlify/functions
```

If you uploaded the files inside a folder, set **Base directory** to that folder name.

## Required Environment Variables

In Netlify, go to:

```text
Project configuration > Environment variables
```

Add:

```bash
APP_MASTER_KEY=<32-byte-base64-secret>
APP_NAME=National Commercial Bank Jamaica Medical Platform
COOKIE_SECURE=true
PUBLIC_URL=https://ncb-medical-platform.netlify.app
REVIEW_NOTIFICATION_EMAIL=hr-review@ncb.local
FROM_EMAIL=no-reply@ncb.local
```

Generate `APP_MASTER_KEY` with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## First Login

After deployment, the Netlify version will create initial accounts in Netlify Blobs.

Default admin:

```text
admin@ncb.local
NCBAdmin!2026
```

Change this immediately after testing.

## Important Notes

- This Netlify version stores app records in Netlify Blobs.
- Email notifications are logged unless an email API integration is added.
- Do not use local `data/` files on Netlify.
- Do not deploy real medical data until IT/security approves the architecture.
