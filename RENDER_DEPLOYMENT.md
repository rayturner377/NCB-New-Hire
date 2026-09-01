# Render Deployment Notes

## Why the Build Failed

The Render log says:

```text
npm error enoent Could not read package.json
ENOENT: no such file or directory, open '/opt/render/project/src/package.json'
```

This means Render is building from a folder that does not contain `package.json`.

In this project, `package.json` is inside the app folder:

```text
NCB NEW HIRE /package.json
```

Render must use that folder as the deploy root.

## Fix Option 1: Set Render Root Directory

In Render:

1. Open your Web Service.
2. Go to **Settings**.
3. Find **Root Directory**.
4. Set it to the folder that contains `package.json`.

If your GitHub repo contains the app files directly at the top level, leave Root Directory blank.

If your GitHub repo contains a folder named `NCB NEW HIRE`, set Root Directory to:

```text
NCB NEW HIRE
```

If the folder name has a trailing space, rename it before uploading to GitHub. Use:

```text
ncb-medical-platform
```

Folder names with trailing spaces can cause deployment issues.

## Fix Option 2: Move Files To Repo Root

The simplest Render setup is to put these files directly at the root of your GitHub repository:

```text
package.json
server.js
public/
scripts/
.env.example
README.md
ARCHITECTURE.md
render.yaml
```

Then Render can find `package.json` automatically.

## Render Settings

Use these settings:

| Setting | Value |
| --- | --- |
| Service Type | Web Service |
| Runtime | Node |
| Build Command | leave blank |
| Start Command | `node server.js` |
| Root Directory | folder containing `package.json` |

## Environment Variables

Set:

```bash
HOST=0.0.0.0
COOKIE_SECURE=true
PUBLIC_URL=https://your-render-service.onrender.com
APP_MASTER_KEY=<32-byte-base64-key>
APP_NAME=National Commercial Bank Jamaica Medical Platform
```

Generate `APP_MASTER_KEY` locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Important Render Free Warning

Render Free has an ephemeral filesystem. This app currently stores encrypted records in the local `data/` folder.

That means on Render Free:

- User accounts can disappear.
- Candidate profiles can disappear.
- Submitted medical forms can disappear.
- Settings can disappear.

Render Free is acceptable for a temporary demo only. Do not use it for real medical records.

For real use, deploy internally or use persistent storage/database approved by IT/security.
