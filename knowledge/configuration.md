# Configuration

> Environment, devcontainer and machine information for this project.
> Only information that affects development is recorded here.
> Related: `architecture.md` (stack) · `projectOverview.md` (context)
> Last updated: 25/10/2026

---

## 1. Current Device (machine used for the current session)

| Item | Value |
| --- | --- |
| Device | DevContainer **"ATI Next.js Vibe Coding Environment"** (Docker container) |
| Repository location | `/workspaces/ATI_PhAnh_group` |
| Operating system | Debian GNU/Linux 12 (bookworm) |
| Architecture | `x86_64` |
| Node.js | `v20.18.0` |
| npm | `10.8.2` |
| CPU / RAM / disk visible to the container | 16 vCPU · ~3.7 GiB RAM · ~921 GiB free on the overlay filesystem |
| Container user / working dir | `node` / `/workspace` |
| Forwarded port | `3000` |
| Tools installed by the image | `git`, `curl`, `sqlite3`, `libsqlite3-dev`, `openssl`, `ca-certificates` |

Observed with `node -v`, `npm -v`, `uname -m`, `nproc`, `free -h`, `df -h`.
The CPU/RAM/disk numbers are **container limits**, not the physical laptop specification.

---

## 2. DevContainer Definition

### `.devcontainer/Dockerfile`

```dockerfile
FROM node:20.18.0-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl sqlite3 libsqlite3-dev openssl ca-certificates
WORKDIR /workspace
USER node
EXPOSE 3000
```

### `.devcontainer/devcontainer.json`

| Setting | Value |
| --- | --- |
| Name | ATI Next.js Vibe Coding Environment |
| Build | Dockerfile |
| `remoteUser` | `node` |
| `forwardPorts` | `3000` |
| `postCreateCommand` | `node -v && npm -v` |
| VS Code settings | bash default profile, format on save, Prettier default formatter |
| VS Code extensions | ESLint, Prettier, Prisma, Cline, Tailwind CSS IntelliSense, GitLens |

---

## 3. Application Runtime and Dependencies

| Component | Version | Source |
| --- | --- | --- |
| Node.js | 20.18.0 (pinned by the image) | `.devcontainer/Dockerfile` |
| Next.js | 15.5.26 | `package.json` |
| React / React DOM | 19.1.0 | `package.json` |
| Zod | ^4.6.5 | `package.json` |
| Sharp | ^0.35.5 | Server-side preprocessing for uploaded PNG/JPEG images; PDFs pass through unchanged |
| TypeScript | ^5 | `package.json` |
| ESLint | ^9 + `eslint-config-next` 15.5.26 + `@eslint/eslintrc` ^3 | `package.json` / `eslint.config.mjs` |
| `@types/node` | ^20 | `package.json` |

### Known engine mismatch (must be validated/fixed)

`npm install` reported:

```text
npm warn EBADENGINE  package: 'eslint-visitor-keys@5.0.1'
  required: { node: '^20.19.0 || ^22.13.0 || >=24' }
  current:  { node: 'v20.18.0', npm: '10.8.2' }
```

Options (pick one, needs a decision before `npm run lint` can be trusted):

1. Bump the base image to `node:20.19.0-bookworm` (or newer 20.x) — preferred.
2. Pin `eslint-visitor-keys`/ESLint to versions that support Node 20.18.
3. Remove the ESLint setup and rely on `npm run typecheck` for validation.

---

## 4. Environment Variables

| Variable | Required now? | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes, for extraction | Gemini API key; server-side only, never expose it in frontend code or commit it |
| `GEMINI_MODEL` | No | Optional Gemini model override; defaults to `gemini-3.8-flash` |
| `GEMINI_MODELS` | No | Comma-separated Vision model list; overrides `GEMINI_MODEL` and allows multiple model branches |
| `TESSERACT_LANGUAGES` | No | Tesseract language codes joined with `+`; defaults to `vie+eng` |
| `TESSERACT_LANG_PATH` | No | Optional local directory or URL containing Tesseract language data; default Tesseract data source is used otherwise |
| `TESSERACT_CACHE_PATH` | No | Optional cache override; defaults to a per-user directory under the OS temporary folder |

Create `.env.local` in the repository root and add:

```text
GEMINI_API_KEY=your-key-from-aistudio
# GEMINI_MODEL=gemini-3.8-flash
# GEMINI_MODELS=gemini-3.8-flash,gemini-3.6-flash
# TESSERACT_LANGUAGES=vie+eng
```

Get a key from <https://aistudio.google.com/apikey>. Never send the key in chat or commit `.env.local`.
Uploaded invoice files are sent to Google's Gemini API for extraction; do not upload documents unless
your organization allows this data sharing. Without the key, `POST /api/extract` returns
`GEMINI_NOT_CONFIGURED` and does not generate mock invoice values.

OCR is executed locally by Tesseract. The first OCR request may download language data for
`TESSERACT_LANGUAGES`; this downloads the OCR model only, not the uploaded document. Language data
is cached outside the repository under the OS temporary folder by default. For offline environments,
set `TESSERACT_LANG_PATH` to a directory containing the corresponding trained data.
PDF pages are rendered locally for OCR; PDF bytes sent to Gemini remain unchanged.
Next.js keeps `@napi-rs/canvas` external to webpack so its native Node binding can load at runtime.

---

## 5. External Services Required for Development

Invoice extraction requires internet access and a Gemini API key. The dashboard can load without the key,
but `POST /api/extract` returns `GEMINI_NOT_CONFIGURED` until it is set.
The local JSON file `data/invoices.json` is used for invoice history; no separate database server is needed.

---

## 6. Development Commands

```bash
# 1. install dependencies
npm install

# 2. start the app and API server
npm run dev
# App: http://localhost:3000
# Dashboard integrated with the API: http://localhost:3000/

# 3. validation
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (see engine mismatch in §3)
npm run build        # production build

# 4. optional: regenerate the sample invoice used for testing
node scripts/make-sample-pdf.mjs

# 5. optional: test the API without the browser
curl -F "file=@samples/sample-invoice.pdf;type=application/pdf" http://localhost:3000/api/extract
curl http://localhost:3000/api/invoices
```

> **Verified on 30/09/2026:** `npm install` completed (`added 308 packages in 8m`) and
> `package-lock.json` exists. `node_modules/.bin` contains `next`, `tsc` and `eslint`.
> The container has only ~3.7 GiB of RAM, so dependency installation (~8 min) and `npm run build`
> (webpack compile ≈ 56 s, then a long lint/type phase) are slow — allow several minutes.
>
> **Dev-server caveat:** in this container `next dev` did **not** hot-reload a changed API route.
> After editing anything under `app/api/`, restart the dev server before re-testing.

---

## 7. Personal Computer Configurations (team)

Each member should add one row and mark which device is used for the current session.
A new agent cannot detect other people's machines, so this table is **maintained by the team**.

| # | Member / role | Device name | Operating system | CPU | RAM | GPU | Node.js | Docker | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | TODO (currently used) | DevContainer in workspace | Debian 12 (container) | 16 vCPU (container) | ~3.7 GiB (container) | — | v20.18.0 | yes | this session |
| 2 | TODO: team member 1 | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| 3 | TODO: team member 2 | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |

How to collect the values:

```bash
node -v          # Node.js version
npm -v           # npm version
docker --version # Docker version (needed for the DevContainer)
uname -a         # Linux / macOS kernel information
systeminfo       # Windows: OS + CPU + RAM (or: Get-ComputerInfo)
```

---

## 8. New Machine Checklist

1. Install Docker Desktop (or Docker Engine) and VS Code with the **Dev Containers** extension.
2. Clone the repository and choose *Reopen in Container*; VS Code builds `.devcontainer/Dockerfile`.
3. Check `node -v` / `npm -v` (the `postCreateCommand` already runs this).
4. `npm install`.
5. `npm run dev` and open port **3000** in the browser.
6. Add your machine to the table in §7.
