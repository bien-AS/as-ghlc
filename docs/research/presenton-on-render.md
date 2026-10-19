# Presenton on Render: self-hosting the deck generator for validated leads

Read on 2026-10-19. Presenton source: `main` at commit [`4e9d853`][commit] (2026-10-19). That is 58 commits after the newest server release, `v0.9.11-beta` (tag commit `e33a91b`, published 2026-09-21) ([release][rel]). The GHCR package page shows `latest` and `v0.9.11-beta` as the same digest ([GHCR][ghcr]). I compared the files cited below against the tag. The only differences that matter here are that `DELETE /api/v1/ppt/presentation/{id}` exists on `main` but not in the tag, plus small edits to `api/middlewares.py` and `start.js`. Line numbers below refer to `4e9d853`.

Sources: the Presenton repo (README, Dockerfile, `docker-compose.yml`, `nginx.conf`, `start.js`, FastAPI and Next.js source, the `docs/` folder, workflows), docs.presenton.ai, and Render's docs and pricing page. Anything these do not state is marked **unconfirmed**. Where the docs and the source disagree, I follow the source and flag the conflict.

## Summary and recommended Render setup

- **Service type:** a Render **Web Service** with a persistent disk. A Private Service cannot be reached from Vercel, because private services "aren't reachable via the public internet" ([Render: private services][r-private]).
- **Image:** build from a small Dockerfile in our repo, `FROM ghcr.io/presenton/presenton:v0.9.11-beta` pinned by digest, with our three templates copied into `/app/templates/<name>/`. Presenton imports every `/app/templates/*/template.json` into its database on startup, and the API accepts the folder name as `template` ([default_templates.py L21-57, L61-104][src-default-tpl]). Render builds Dockerfiles from Git ([Render: Docker][r-docker]). If we upload templates through the UI instead, deploy the stock image as an "Existing Image" ([Render: deploy an image][r-image]).
- **Plan:** `2c-8g` (2 CPU, 8 GB, $135/month) to start. Presenton says not to plan production below 2 vCPU / 4 GB, and recommends 4 vCPU / 8 GB for a small team ([system requirements][d-sysreq]). In Presenton's own load test, four concurrent 10–40-slide jobs drove a memory spike (process heap is estimated, not measured) to about 11.9 GB ([resource-usage report][src-resource]). `2c-4g` ($85) is the floor. `4c-8g` ($175) matches Presenton's small-team figure ([Render pricing][r-pricing]).
- **Disk:** mount at `/app_data`, 20 GB ($0.25/GB/month, so $5) ([Render pricing][r-pricing]). The disk is required even with an external database ([system requirements][d-sysreq]). A disk limits the service to one instance and removes zero-downtime deploys ([Render: disks][r-disks]).
- **Database:** keep the default SQLite on the disk. It lives at `/app_data/fastapi.db` when `DATABASE_URL` is unset ([db_utils.py][src-dbutils]). Postgres is supported (`postgresql://` becomes asyncpg), but it does not remove the need for the disk, and the instance cannot scale out anyway.
- **Environment:**
  - `LLM=openrouter`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=<an Anthropic model id on OpenRouter>`, `OPENROUTER_DATA_COLLECTION=deny`, `OPENROUTER_ZDR=true` ([README env table][src-readme]).
  - `AUTH_USERNAME` and `AUTH_PASSWORD`, set before first boot (see Q3).
  - `PRESENTON_PUBLIC_URL=https://<our domain>`, `PRESENTATION_GENERATION_MODE=standard`, `PRESENTON_COMMUNITY_ENABLED=false`, `DISABLE_ANONYMOUS_TRACKING=true` ([README][src-readme]).
  - `IMAGE_PROVIDER=pexels` with `PEXELS_API_KEY`, or `DISABLE_IMAGE_GENERATION=true`.
  - `MEM0_ENABLED=false`, or point `MEM0_LLM_*` at OpenRouter. The default targets a local Ollama at `host.docker.internal:11434`, which does not exist on Render ([mem0_oss_memory.py L110-123][src-mem0]).
- **Access:** use Presenton's own auth on a custom HTTPS domain. Our Inngest functions send a per-user `sk-presenton-…` API key as a Bearer token ([README: API and MCP authentication][src-readme]). Render's inbound IP allowlists for web services need the **Scale** workspace plan ($499/month) ([Render: inbound IP rules][r-iprules]; [pricing][r-pricing]).
- **Flow:**
  1. An Inngest step calls `POST /api/v1/ppt/presentation/generate/async`.
  2. Inngest polls `GET /api/v1/ppt/presentation/status/{task_id}` until the status is `completed` or `error`.
  3. Inngest downloads `data.path` with the same Bearer key.
  4. We store `presentation_id` and `edit_path` against the lead.
- **Two blockers to settle before building:**
  1. **The booking embed cannot live inside a Presenton slide.** The template element model has no iframe, embed, HTML or hyperlink type (Q4).
  2. **The built-in editor is not designed to be iframed into our app** on the self-hosted build (Q5).

## 1. Deployment

**Image and tags**

- The image is `ghcr.io/presenton/presenton`. Docs: "`latest` follows the newest published image". For production, pin "an explicit version tag", or a digest ([docs: Docker][d-docker]).
- The release workflow pushes `ghcr.io/presenton/presenton:<release tag>` when a GitHub release is published. A manual run pushes `:dev`. It builds `linux/amd64` and `linux/arm64` ([docker-release.yml][src-release-wf]).
- The workflow file does not push `latest`, yet `latest` exists on GHCR next to `v0.9.11-beta`, and per-arch `-amd64`/`-arm64` tags are also listed ([GHCR][ghcr]). How `latest` gets moved is **unconfirmed**.
- Every release so far is `-beta`.

**Ports**

- The container exposes port 80 ([Dockerfile L144][src-dockerfile]). nginx listens on 80 ([nginx.conf L26][src-nginx]) and proxies to:
  - Next.js on 3000,
  - FastAPI on 8000 (for `/api/v1/` and `/api/v2/`),
  - the MCP server on 8001 (for `/mcp`).

  All three bind inside the container ([start.js L44-46][src-start]).

- Port 1455 is only for the ChatGPT/Codex OAuth callback ([docs: Docker][d-docker]). We do not need it.
- Render forwards public traffic to one port and "usually detects" a non-default one ([Render: web services][r-web]). Setting `PORT=80` on the service is safe. `start.js` passes `PORT=3000` explicitly to Next.js ([start.js L575-595][src-start]), and FastAPI gets `--port 8000`.

**Environment variables**

- **Required by the image:** `APP_DATA_DIRECTORY`. The Dockerfile sets it to `/app_data` and `start.js` throws without it ([Dockerfile L78][src-dockerfile]; [start.js L48-51][src-start]).
- **Provider selection:** `LLM` takes one of `openai, deepseek, google, vertex, azure, bedrock, openrouter, fireworks, together, cerebras, anthropic, litellm, lmstudio, ollama, custom, codex` ([llm_provider enum][src-llm-enum]; [README][src-readme]). Each provider has its own `*_API_KEY`, `*_MODEL`, and usually `*_BASE_URL` (Q2).
- **Images:**
  - `IMAGE_PROVIDER` takes `pexels, pixabay, gemini_flash, nanobanana_pro, gpt-image-2, gpt-image-1.5, comfyui, open_webui, openai_compatible`.
  - Each provider takes its own key: `PEXELS_API_KEY`, `PIXABAY_API_KEY`, or the `OPENAI_COMPAT_IMAGE_*` trio.
  - Also: `DISABLE_IMAGE_GENERATION` and `ENABLE_PARALLEL_IMAGE_GENERATION` ([README: Image generation][src-readme]).
- **Database:** `DATABASE_URL` (optional SQLAlchemy URL; SQLite under app data when unset) and `MIGRATE_DATABASE_ON_STARTUP` (default `true`) ([README: Database][src-readme]). Pool tuning: `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`, `DB_POOL_PRE_PING` ([db_utils.py][src-dbutils]).
- **Auth:** `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_OVERRIDE_FROM_ENV`, `RESET_AUTH` ([README: Multi-user authentication][src-readme]). The code also honours **`DISABLE_AUTH`**, which turns off all auth checks ([get_env.py L67-80][src-getenv]; [middlewares.py L55-69][src-mw]). That flag is meant for the Electron runtime. Never set it on Render.
- **Behaviour:**
  - `PRESENTON_PUBLIC_URL` is the origin used in generated download, edit and preview links.
  - `PRESENTATION_GENERATION_MODE` takes `both`, `standard` or `smart`. It is "not an authorization control for the underlying REST API" ([generation modes][src-modes]).
  - `PRESENTON_COMMUNITY_ENABLED`, `DISABLE_ANONYMOUS_TRACKING`, `MAX_OUTLINE_WORDS`, and `LLM_*` tuning ([README][src-readme]).
- **Storage paths** baked into the image: `APP_DATA_DIRECTORY=/app_data`, `TEMP_DIRECTORY=/tmp/presenton`, `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` ([Dockerfile L78-87][src-dockerfile]).
- **Doc conflict:** docs.presenton.ai's Docker page still recommends `CAN_CHANGE_KEYS=false` ([docs: Docker][d-docker]). The README says `CAN_CHANGE_KEYS` "is ignored" ([README][src-readme]).

**Persistent disk and what goes on it**

- `start.js` creates `/app_data/{exports,images,uploads,fonts,templates,pptx-to-html,pptx-to-json}` and `/app_data/userConfig.json` ([start.js L48-60][src-start]).
- `/app_data` also holds:
  - the default SQLite database `fastapi.db` ([db_utils.py][src-dbutils]),
  - Mem0 memory at `/app_data/mem0` ([README: Mem0][src-readme]),
  - settings and auth state ([docs: storage][d-storage]).
- `userConfig.json` holds "a hashed recovery copy of the primary administrator credentials and the session-signing secret" ([README][src-readme]). On startup, provider env vars are copied into it ([start.js L518-525][src-start]). Whether provider API keys are encrypted at rest there is **unconfirmed**.
- "An external PostgreSQL or MySQL database doesn't replace `/app_data`." Plan for about 50–250 MB per retained image-rich 10-slide deck ([system requirements][d-sysreq]).
- Without a durable mount, "a replacement container starts with empty application data" ([docs: hosting troubleshooting][d-hosting-ts]).

**CPU, memory and what runs inside**

- One container runs nginx, Next.js, FastAPI, the MCP server, LiteParse document parsing, Tesseract OCR, and the export service. The image includes Chromium, OCR, fonts and export dependencies ([system requirements][d-sysreq]; [Dockerfile L89-110][src-dockerfile]).
- Export uses headless **Chromium**, pinned to a Debian package version and driven by Puppeteer through the `@presenton/export-core` runtime ([Dockerfile L74, L87, L104-107][src-dockerfile]; [run-presentation-export.mjs][src-runner]). Q6 has the details.
- Sizing from Presenton: 2 vCPU / 4 GB / 10 GB disk for evaluation; 4 vCPU / 8 GB / 20–50 GB for a small team (about 2 simultaneous jobs); 8 vCPU / 16 GB for API-heavy use (about 4 jobs) ([system requirements][d-sysreq]).
- Presenton's own k6 test ran 4 concurrent users generating 10/20/30/40-slide decks, without export:
  - median CPU was 3.7%,
  - a burst after the test reached 1,087% CPU (about 11 cores), and
  - estimated process heap reached 11.9 GB.

  The report says the cause of the burst is unknown and recovery was not captured ([presenton-resource-usage.md][src-resource]). We should serialize generation per instance with an Inngest concurrency key.

**Cold start**

- Presenton documents no startup time ([system requirements][d-sysreq]; [docs: Docker][d-docker]). **Unconfirmed**; measure it on first deploy.
- Startup work:
  - checks the export runtime ([start.js L472-494][src-start]),
  - runs DB migrations when `MIGRATE_DATABASE_ON_STARTUP=true`,
  - imports the bundled templates ([default_templates.py][src-default-tpl]),
  - starts the four processes.
- Render's 15-minute spin-down and roughly one-minute spin-up are stated for **Free** instances only ([Render: free][r-free]). Free instances cannot have a disk anyway.

## 2. Model providers

- **Anthropic directly:** yes. Set `LLM=anthropic` with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` ([README][src-readme]; [llm_provider enum][src-llm-enum]). The README says the default model is `claude-3-5-sonnet-20241022`. The code default is `claude-sonnet-4-20250514` ([constants/llm.py L14][src-llm-const]). Set it explicitly.
- **OpenRouter:** yes, as a first-class provider.
  - `LLM=openrouter`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default `openai/gpt-4o`), `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`) ([README][src-readme]; [constants/llm.py L10][src-llm-const]).
  - Routing controls: `OPENROUTER_PROVIDER_ORDER`, `OPENROUTER_ALLOW_FALLBACKS`, `OPENROUTER_REQUIRE_PARAMETERS`, `OPENROUTER_DATA_COLLECTION` (`allow`/`deny`), `OPENROUTER_ZDR` ([README][src-readme]).
  - This lets us reuse the OpenRouter account the app already uses.
- **Any OpenAI-compatible endpoint:** `LLM=custom` with `CUSTOM_LLM_URL`, `CUSTOM_LLM_API_KEY`, `CUSTOM_MODEL`. The server "must implement `POST /v1/chat/completions`". `LLM=litellm` also works, with `LITELLM_BASE_URL`, `LITELLM_API_KEY`, `LITELLM_MODEL` ([README][src-readme]).
- **Model per request:** no. `GeneratePresentationRequest` has no model or provider field ([generate_presentation_request.py][src-genreq]). Provider settings are installation-wide; admins update "shared keys" in Settings ([README][src-readme]). Env values are written into `userConfig.json` at startup ([start.js L518-525][src-start]), and a middleware reloads that file into the environment on every request ([middlewares.py L23-26][src-mw]). Changing models means changing env or Settings, not the request.
- **Vision requirement:** only for _creating_ a template from a PPTX. "The configured text model is also the model used for Template V2 analysis," so it must accept images. Generating from an existing template needs only structured JSON output ([template-v2.md][src-tplv2]). A Claude model via OpenRouter covers both.

## 3. API

**Generate**

- `POST /api/v1/ppt/presentation/generate` (synchronous) and `POST /api/v1/ppt/presentation/generate/async` ([presentation.py L3130, L3201][src-pres]; router prefix in [router.py][src-ppt-router]).
- Request body `GeneratePresentationRequest` ([generate_presentation_request.py][src-genreq]):

| Field                       | Type / default                                                             | Notes                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content`                   | string, required                                                           | Prompt or source text. May be empty if `slides_markdown` or `files` is given.                                                                                  |
| `slides_markdown`           | string[] or null                                                           | One Markdown string per slide. Skips outline generation, but the LLM still maps the text into layout fields "so text may be rephrased" ([README][src-readme]). |
| `instructions`              | string or null                                                             | Extra generation instructions                                                                                                                                  |
| `tone`                      | `default`, `casual`, `professional`, `funny`, `educational`, `sales_pitch` | ([enums/tone.py][src-tone])                                                                                                                                    |
| `verbosity`                 | `concise`, `standard`, `text-heavy`                                        | ([enums/verbosity.py][src-verbosity])                                                                                                                          |
| `web_search`                | bool, false                                                                |                                                                                                                                                                |
| `n_slides`                  | int or null                                                                | Auto-detected when null. Maximum 50 ([constants/presentation.py L4][src-maxslides]).                                                                           |
| `language`                  | string or null                                                             | Auto-detected when null. The README says the default is "English".                                                                                             |
| `template`                  | string, `"general"`                                                        | A bundled folder name or a TemplateV2 id (a custom-template prefix is stripped) ([presentation.py L194-227, L2626-2641][src-pres])                             |
| `include_table_of_contents` | bool, false                                                                |                                                                                                                                                                |
| `include_title_slide`       | bool, true                                                                 |                                                                                                                                                                |
| `files`                     | string[] or null                                                           | Paths returned by `POST /api/v1/ppt/files/upload`                                                                                                              |
| `export_as`                 | `pptx` or `pdf`, default `pptx`                                            |                                                                                                                                                                |
| `trigger_webhook`           | bool, false                                                                | Has no effect today; see Webhooks below                                                                                                                        |

- **Response:** `{ presentation_id, path, edit_path }` ([presentation_and_path.py][src-pap]). Example: `path` = `/app_data/<…>.pptx`, `edit_path` = `/presentation?id=<uuid>`. Prepend the server root URL ([README][src-readme]). The handler rewrites both into absolute links when it can ([presentation.py L3146-3151][src-pres]).

**Sync or async, and polling**

- The sync endpoint blocks until generation and export finish.
  - nginx inside the container allows 30 minutes on `/api/v1/` ([nginx.conf L45-50][src-nginx]).
  - Render allows HTTP responses up to 100 minutes ([Render vs Vercel][r-vs-vercel]).
  - Our Vercel function limit is not covered here. **Unconfirmed**; do not use sync from Vercel.
- Async returns an `AsyncTaskModel` with `id` = `task-<hex>`, `status` = `pending`, and `data.presentation_id` ([presentation.py L3201-3240][src-pres]; [async_task.py][src-asynctask]).
- Poll `GET /api/v1/ppt/presentation/status/{id}`. Status is `pending`, `completed` or `error` ([async_task_status.py][src-asyncstatus]). On `completed`, `data` includes `path` and `edit_path` ([presentation.py L3072-3090][src-pres]). Presenton gives no polling interval ([docs: get generation status][d-status]).
- The async job runs as a FastAPI `BackgroundTasks` task inside the web process ([presentation.py L3225][src-pres]). I found no resume logic, so a restart or deploy most likely leaves the task stuck at `pending` (**unconfirmed**). Inngest should time out and retry.

**Webhooks**

- `POST /api/v1/webhook/subscribe` takes `{url, secret, event}`. Events are `presentation.generation.completed` and `presentation.generation.failed` ([webhook/router.py][src-webhook-router]; [webhook_event.py][src-webhook-event]).
- The secret is sent as `Authorization: Bearer <secret>`, not as an HMAC signature. Delivery errors are swallowed with no retry ([webhook_service.py L36-55][src-webhook-svc]).
- `WebhookService.send_webhook` is not called anywhere in the FastAPI source at this commit. Webhooks will not fire; use polling.

**Fetch, edit and export an existing presentation** (all under `/api/v1/ppt/presentation` unless noted; [presentation.py][src-pres])

- `GET /all` and `GET /{id}` return the presentation with its slides (L1487, L1539). `DELETE /{id}` exists on `main` only (L1560).
- `POST /{id}/export` with body `{"export_as": "pptx"|"pdf"}` re-exports without regenerating (L1603-1639).
- `POST /edit` takes `{presentation_id, slides:[{index, content}], export_as}`. It deep-merges new content into the listed slides and re-exports (L3260; [presentation_from_template.py][src-editreq]). `POST /derive` does the same into a new presentation (L3311).
- `PATCH /update` changes `title`, `n_slides` and `slides` (L2488). `PATCH /slide_update` replaces one slide (L2546).
- `POST /api/v1/ppt/slide/edit` takes `{id, prompt}` for an LLM edit of one slide ([slide.py L36][src-slide]).

**Authentication**

- Every `/api/*` path needs auth except `/api/v1/auth/{status,verify,setup,login,logout}`. `/app_data/*` needs auth too, except `fonts/` and `templates/` ([middlewares.py L29-53][src-mw]).
- Two credentials are accepted ([principal.py][src-principal]):
  - the `presenton_session` JWT cookie (browser), and
  - `Authorization: Bearer sk-presenton-…` (API key).
- docs.presenton.ai's status page says "HTTP Basic". That is stale against the source ([docs: get generation status][d-status]).
- **Getting a key:**
  - An admin creates it in **Admin → API keys**, or calls `POST /api/v1/admin/api-keys` with `{user_id, label, expiry_days}` _from a browser session_. API keys cannot call admin routes ([middlewares.py L100-115][src-mw]; [README][src-readme]).
  - `expiry_days` defaults to 90, with a range of 1–365 ([schemas.py L59][src-schemas]).
  - A key "represent[s] exactly the selected Presenton user", and data is owner-scoped. Use one service user for the app.
- **Downloading exports:** nginx gates `/app_data/exports/` with an `auth_request` to `/api/v1/auth/verify` and forwards the `Authorization` header ([nginx.conf][src-nginx]; [auth router L81-106][src-auth-router]). The same Bearer key downloads the file.
- **Open by default?** Until the first user exists, protected routes return `428 setup_required` ([middlewares.py L80-93][src-mw]). `POST /api/v1/auth/setup` is public and answers `409` once credentials exist ([auth router L110-142][src-auth-router]).
  - On a public URL, **whoever calls setup first becomes the primary admin**. Set `AUTH_USERNAME` and `AUTH_PASSWORD` so the admin is created on first boot ([README][src-readme]; [docs: authentication][d-auth]).
- **Other exposure notes:**
  - The FastAPI session cookie is `cookie_secure=False`, `SameSite=lax` ([users.py L188-192][src-users]). Render's edge redirects HTTP to HTTPS ([Render: web services][r-web]), which limits the first issue.
  - `/app_data/templates/` and `/app_data/fonts/` are served without auth ([nginx.conf][src-nginx]). Our template images and fonts are readable by anyone who knows a URL.
  - Presenton's docs give no guidance on exposing an instance publicly ([docs: Docker][d-docker]; [docs: authentication][d-auth]).

## 4. Templates

**Format**

- The current format is **Template V2**: a `template.json` with `layouts` (certified slide layouts), `merged_components`, `fonts`, `theme`, plus static assets ([template-v2.md][src-tplv2]; the bundled [templates/general][src-tpl-general]).
- Each layout is a list of components built from typed elements: `text`, `container`, `image`, `text-list`, `table`, `vector`, `chart`, `infographic`, `flex`, `grid`, `group`. Layouts use a fixed 1280×720 coordinate system ([elements.py L203-624][src-elements]; [template-v2.md][src-tplv2]).
- The element classes are annotated "Konva Group" and "Konva Image", so the editor renders on a canvas ([elements.py L224, L240][src-elements]).
- Elements with `decorative=false` become JSON-schema fields that the LLM fills ([template-v2.md][src-tplv2]).
- The README still says "Create unlimited presentation designs with HTML and Tailwind CSS" ([README][src-readme]). That describes the older format. Generation now "supports TemplateV2 rows and bundled TemplateV2 names only" ([presentation.py L2626-2627][src-pres]).

**How templates are created**

- In the UI: upload a filled PPTX, fix missing fonts, then **Create Template**. Each source slide can become a layout ([docs: template creation][d-tplcreate]).
- Over the API: `POST /api/v1/ppt/template/fonts-upload-and-slides-preview`, then `POST /api/v1/ppt/template/async` (polled like generation). Layouts can be edited with `PATCH /template/{id}/layouts` ([template.py L1188-1974][src-template]).
- Creation needs a vision-capable text model and runs up to ten slides concurrently ([template-v2.md][src-tplv2]).

**Where templates live, and how to keep ours in Git**

- UI-created templates are rows in the DB (`TemplateV2`, owner-scoped) plus assets under `/app_data/templates/` ([template_v2.py][src-tplv2-model]; [start.js][src-start]).
- Bundled templates are read from `/app/templates/<folder>/template.json` on every startup:
  - they are upserted as `is_default=True`,
  - their static assets are copied, and
  - default templates no longer on disk are removed

  ([default_templates.py L21-57, L153][src-default-tpl]). The API resolves `template: "<folder>"` to that template ([default_templates.py L61-104][src-default-tpl]).

- `scripts/convert-template.mjs` and `scripts/convert-presentation-template.mjs` package a template or presentation JSON into this bundled format with its assets ([scripts][src-scripts]).
- The Git workflow:
  1. Build each template once from a branded PPTX in a local Presenton instance.
  2. Export its JSON.
  3. Run the converter.
  4. Commit the folder, for example `discovery-call/`, `follow-up/`, `strategy-session/`.
  5. Copy it into `/app/templates/` in our Dockerfile.
- The exact export step from a running instance is **unconfirmed**. `GET /api/v1/ppt/template/{id}` returns the template ([template.py L2121][src-template]), but I did not verify that it matches the converter's input.

**Can a template carry a calendar iframe or embed?**

No.

- There is no iframe, embed, HTML or video element type in the layout schema ([elements.py L624][src-elements]).
- Text runs carry only `text` and `font`, with no hyperlink field ([elements.py L181-191][src-elements]).
- What a template can carry is a fixed **image**, such as a QR code for the booking page, and text showing the URL.
- Whether a URL typed as text becomes a clickable link in PPTX or PDF is **unconfirmed**. Presenton's export docs do not cover links or embeds ([docs: export][d-export]; [docs: editing and export troubleshooting][d-export-ts]).

## 5. Editing

**Built-in editor**

- Each presentation opens at `edit_path` = `/presentation?id=<uuid>` ([presentation.py L1638][src-pres]).
- The editor offers canvas editing (move, resize, text, images, shapes, tables, charts, groups), prompt-based edits and an AI assistant ([docs index][d-index]).

**Embedding in our app**

- Presenton documents an iframe embed with scoped tokens (`presentation:read`/`edit`/`export`) through `POST /api/v3/presentation/integrate`. The page says this "is available in the Presenton Cloud API v3" ([docs: embed preview][d-embed]).
- No `integrate` route or integration token exists in the self-hosted source at this commit; I searched for `integrate` and `integration_token` and found neither. **Not available self-hosted.**
- Iframing the editor directly would need the user to be signed in to Presenton inside the frame:
  - The session cookie is `SameSite=lax` ([users.py L192][src-users]), and browsers do not send Lax cookies on cross-site iframe requests.
  - It could work only if both apps sit on subdomains of one registrable domain, and each rep would need a Presenton account.
  - This is inference from the cookie attribute; it is **unconfirmed** by Presenton.
- Presenton sets no `X-Frame-Options` or `frame-ancestors` header in `nginx.conf`, `next.config.mjs` or `proxy.ts` ([nginx.conf][src-nginx]; [next.config.mjs][src-nextconfig]; [proxy.ts][src-proxy]).
- Practical options:
  - Open `edit_path` in a new tab, with reps holding Presenton accounts created by the admin. Accounts are local to Presenton; enterprise SSO is a paid offering ([README: Enterprise][src-readme]).
  - Or edit through the API (next list).

**Editing over the API**

- `POST /edit`, `POST /derive`, `PATCH /update`, `PATCH /slide_update`, `POST /slide/edit` (Q3).
- After any edit, call `POST /{id}/export` to get a fresh file.

## 6. Export

**How it works**

- `export_presentation` hands an internal render URL for the presentation to `@presenton/export-core` ([export_utils.py L43-75][src-export-utils]). That runtime drives Chromium through Puppeteer ([run-presentation-export.mjs][src-runner]; [Dockerfile L87][src-dockerfile]).
- Output lands in `/app_data/exports` ([run-presentation-export.mjs][src-runner]).
- The export runtime version is pinned in `package.json` as `presentationExportVersion: v1.0.34` ([package.json][src-pkg]). It is downloaded from `presenton/presenton-export` releases at image build time ([sync-presentation-export.cjs][src-sync]).
- That repo contains only a README and prebuilt `presenton-export-core-opensource-*.tgz` assets. It has no LICENSE file and no source ([presenton-export repo][presenton-export]).

**PPTX editability**

- The README promises "Fully editable PPTX export" ([README][src-readme]).
- The docs only advise checking "chart labels, table cells, and object layers" after export. They do not list which elements stay editable ([docs: export][d-export]).

**Fonts**

- The runtime image deletes every non-Noto font ([Dockerfile L112-115][src-dockerfile]).
- Custom fonts must be uploaded: per template during creation, or via `POST /api/v1/ppt/fonts/upload` (admin browser session only) ([template-v2.md][src-tplv2]; [middlewares.py L104-107][src-mw]). They are stored in `/app_data/fonts`.
- "Custom fonts may be substituted in the exported file" ([docs: editing and export troubleshooting][d-export-ts]). Whether fonts are embedded in the PPTX is **unconfirmed**.

**Links, embeds and video**

- Not covered by Presenton's docs ([docs: export][d-export]; [docs: editing and export troubleshooting][d-export-ts]).
- The element model has no type for any of them (Q4).

**Other notes**

- The export docs warn that an older version can download if the latest edit is not saved ([docs: export][d-export]).
- Presenton's resource test excluded PPTX export, so its memory cost is unmeasured ([presenton-resource-usage.md][src-resource]).

## 7. Render

**Service type**

- Use a **Web Service** from a Docker build or a registry image. GHCR is supported, including private images with a `read:packages` token ([Render: deploy an image][r-image]; [Render: Docker][r-docker]).
- Image-backed services do **not** auto-deploy when a tag moves. Use "Deploy latest reference" or a deploy hook with `imgURL` ([Render: deploy an image][r-image]). Pinning a tag is natural on Render.
- A Private Service has no public address, so Vercel cannot reach it ([Render: private services][r-private]). Only Render services in the same region and workspace share the private network. AWS PrivateLink exists for AWS-hosted systems on Pro and above ([Render: private network][r-privnet]).
- A private service would need a second, public Render service in front of it to enforce our auth. That adds a component for no gain over Presenton's own API keys.

**Persistent disk**

- Available on paid web services, private services and background workers ([Render: disks][r-disks]). The pricing page lists persistent disks at $0.25/GB/month ([Render pricing][r-pricing]). Free instances have no disk ([Render: free][r-free]).
- A disk means:
  - one instance only,
  - no zero-downtime deploys, so the service is down "for a few seconds" plus Presenton's startup time,
  - daily snapshots kept at least 7 days, and
  - size can grow but not shrink

  ([Render: disks][r-disks]).

- `/app_data` is an allowed mount path. The disallowed paths are `/`, `/opt`, `/home`, `/etc` and a few others ([Render: disks][r-disks]).

**Instance sizes and prices**

Per-service compute, as listed on render.com/pricing on 2026-10-19:

| Plan ID                | CPU | RAM    | $/month |
| ---------------------- | --- | ------ | ------- |
| `free`                 | <1  | 512 MB | 0       |
| `0.5c-512mb` (Starter) | 0.5 | 512 MB | 7       |
| `1c-2g` (Standard)     | 1   | 2 GB   | 25      |
| `2c-4g` (Pro)          | 2   | 4 GB   | 85      |
| `2c-8g`                | 2   | 8 GB   | 135     |
| `2c-16g`               | 2   | 16 GB  | 200     |
| `4c-8g` (Pro Plus)     | 4   | 8 GB   | 175     |
| `4c-16g` (Pro Max)     | 4   | 16 GB  | 225     |
| `8c-16g`               | 8   | 16 GB  | 300     |

Sources: [Render pricing][r-pricing]; [Render: compute plans][r-compute]. Larger plans go up to 12 CPU / 96 GB. Private services use the same plans except `free` ([Render: compute plans][r-compute]).

Workspace plans:

- Hobby: $0/month + compute, 1 team seat.
- Pro: $25/month + compute.
- Scale: $499/month + compute.
- Enterprise: custom.

([Render pricing][r-pricing]). Bandwidth is 5 GB/month included, then $0.15/GB (Hobby column of the comparison table) ([Render pricing][r-pricing]).

**Free tier**

Free web services spin down after 15 minutes without inbound traffic, take about a minute to spin up, lose local files, and can be restarted at any time ([Render: free][r-free]). They are unsuitable here.

**Restricting access**

- **Inbound IP rules** for web services need the Scale or Enterprise plan. Datastores get them on every plan ([Render: inbound IP rules][r-iprules]). Vercel's egress IPs are outside Render's docs; whether we have stable ones is **unconfirmed**.
- In practice, rely on:
  - Presenton auth: admin created from env on first boot, one API key for the app's service user, rotated within the 1–365-day expiry,
  - a custom domain with Render-managed TLS ([Render: web services][r-web]), and
  - a strong admin password, with no `DISABLE_AUTH`.
- **Health check path:** `/api/v1/auth/status`. It is public ([middlewares.py L30-36][src-mw]) and Render lets you set a health check path ([Render: web services][r-web]). This is our suggestion; Presenton documents no health endpoint ([docs: Docker][d-docker]).

**How the Vercel app reaches it**

- Store `PRESENTON_URL` and `PRESENTON_API_KEY` as server-side env vars.
- Inngest steps make HTTPS calls with `Authorization: Bearer`.
- Never send the key to the browser. Download the exported file server-side and store it in Supabase Storage so reps never need a Presenton URL to read a deck.

## 8. Risks

- **Licence.**
  - Presenton is Apache-2.0: root `LICENSE` and `servers/fastapi/LICENSE`, "Copyright 2025 presenton", and GitHub's licence detection agrees ([LICENSE][src-license]; GitHub API `license.spdx_id = Apache-2.0`).
  - `NOTICE` lists third-party components, including `sharp-libvips` binaries under LGPL-3.0-or-later ([NOTICE][src-notice]).
  - The export runtime (`@presenton/export-core`, downloaded as a prebuilt tarball) ships from a repo with **no licence file and no source** ([presenton-export][presenton-export]). Its licence is **unconfirmed** and needs a check before we depend on it commercially.
- **Booking slide (blocking as specified).** A live calendar iframe cannot be placed in a Presenton slide, and none of the outputs (editor canvas, PPTX, PDF) has a representation for one (Q4).
  - Options: a QR code image plus a printed booking URL on the last slide; or put the live embed on our own deck page next to the PDF.
  - Post-processing the PPTX to add a hyperlink would be lost on the next Presenton re-export.
- **Editable after generation.** This holds _inside Presenton_: canvas editor, edit APIs, and an editable PPTX download. It does not hold _inside our app_: there is no self-hosted embed token (Q5). Decide whether reps edit in a Presenton tab with Presenton accounts, or edit through our own UI calling the edit APIs.
- **Beta software.** Every release is `-beta`, and docs and README already disagree with the code in places: the default Anthropic model, `CAN_CHANGE_KEYS`, "HTTP Basic" auth, and "HTML and Tailwind" templates. Pin a digest and re-test templates on each upgrade.
- **Lost jobs.** Async generation runs in-process, and disk-backed deploys restart the only instance. Webhooks are never sent. Inngest must poll with a timeout and retry.
- **Memory spikes.** See Q1. Serialize jobs and watch Render memory metrics.
- **Data handling.**
  - Lead data in `content` goes to OpenRouter (set `OPENROUTER_DATA_COLLECTION=deny` and `OPENROUTER_ZDR=true`) and to the image provider.
  - With `web_search` true it goes to a search provider; `WEB_SEARCH_PROVIDER=auto` uses the provider's native search for OpenAI, Google and Anthropic ([README][src-readme]).
  - Decks, uploads and possibly provider keys sit on the Render disk and in its snapshots ([docs: storage][d-storage]).
  - Anonymous telemetry is on unless `DISABLE_ANONYMOUS_TRACKING=true`. That flag "does not stop content from going to any configured external AI, image, or search provider" ([docs: storage][d-storage]).
  - The Community gallery calls Presenton's cloud unless `PRESENTON_COMMUNITY_ENABLED=false` ([README][src-readme]).
- **Template fidelity.** Text may be rephrased to fit layouts even with `slides_markdown` ([README][src-readme]). Templates built from a PPTX depend on vision-model passes that fall back to "fidelity-preserving" layouts when they fail ([template-v2.md][src-tplv2]). Review each template's layouts before relying on it.

## Open questions

1. Is a QR code plus printed URL acceptable for the booking slide, with the live calendar embed on our own deck page? If not, Presenton does not fit that requirement.
2. Do reps edit decks in Presenton itself (separate accounts, new tab), or only through our app via the edit APIs?
3. What is the licence of `@presenton/export-core`? Ask the maintainers, or inspect the tarball's `package.json` before we sign off.
4. Is there a supported way to export a UI-created template's JSON for `convert-template.mjs`? Verify on a local instance before choosing the template-in-Git workflow.
5. Do clickable hyperlinks survive into PPTX and PDF exports? Test with the real template.
6. Cold-start time and peak memory of one 10–15-slide generation plus export on `2c-4g` versus `2c-8g`: measure on the first deploy.
7. Should the in-container SQLite move to Supabase Postgres (`DATABASE_URL`)? It changes nothing about the disk, so I recommend not doing it unless we want Presenton data in our backups.
8. Which exact OpenRouter model id for Claude to set in `OPENROUTER_MODEL`? Check OpenRouter's model list; this research did not.

## Sources

Presenton source, commit `4e9d853cfac27e5330e62087dd9371d8b18e1534` unless noted:

[commit]: https://github.com/presenton/presenton/commit/4e9d853cfac27e5330e62087dd9371d8b18e1534
[rel]: https://github.com/presenton/presenton/releases/tag/v0.9.11-beta
[ghcr]: https://github.com/presenton/presenton/pkgs/container/presenton
[src-readme]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/README.md
[src-dockerfile]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/Dockerfile
[src-nginx]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/nginx.conf
[src-start]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/start.js
[src-pkg]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/package.json
[src-license]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/LICENSE
[src-notice]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/NOTICE
[src-release-wf]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/.github/workflows/docker-release.yml
[src-resource]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/docs/presenton-resource-usage.md
[src-modes]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/docs/presentation-generation-modes.md
[src-tplv2]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/docs/template-v2.md
[src-tpl-general]: https://github.com/presenton/presenton/tree/4e9d853cfac27e5330e62087dd9371d8b18e1534/templates/general
[src-scripts]: https://github.com/presenton/presenton/tree/4e9d853cfac27e5330e62087dd9371d8b18e1534/scripts
[src-sync]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/scripts/sync-presentation-export.cjs
[src-runner]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/scripts/run-presentation-export.mjs
[src-pres]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/ppt/endpoints/presentation.py
[src-ppt-router]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/ppt/router.py
[src-slide]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/ppt/endpoints/slide.py
[src-template]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/ppt/endpoints/template.py
[src-genreq]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/models/generate_presentation_request.py
[src-pap]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/models/presentation_and_path.py
[src-editreq]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/models/presentation_from_template.py
[src-asynctask]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/models/sql/async_task.py
[src-asyncstatus]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/enums/async_task_status.py
[src-tone]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/enums/tone.py
[src-verbosity]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/enums/verbosity.py
[src-maxslides]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/constants/presentation.py
[src-llm-const]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/constants/llm.py
[src-llm-enum]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/enums/llm_provider.py
[src-getenv]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/utils/get_env.py
[src-dbutils]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/utils/db_utils.py
[src-export-utils]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/utils/export_utils.py
[src-mw]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/middlewares.py
[src-principal]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/auth/principal.py
[src-auth-router]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/auth/router.py
[src-users]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/auth/users.py
[src-schemas]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/auth/schemas.py
[src-webhook-router]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/api/v1/webhook/router.py
[src-webhook-event]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/enums/webhook_event.py
[src-webhook-svc]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/services/webhook_service.py
[src-mem0]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/services/mem0_oss_memory.py
[src-default-tpl]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/templates/default_templates.py
[src-elements]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/templates/v2/models/elements.py
[src-tplv2-model]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/models/sql/template_v2.py
[src-nextconfig]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/nextjs/next.config.mjs
[src-proxy]: https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/nextjs/proxy.ts
[presenton-export]: https://github.com/presenton/presenton-export
[d-index]: https://docs.presenton.ai/llms.txt
[d-sysreq]: https://docs.presenton.ai/hosting/system-requirements
[d-docker]: https://docs.presenton.ai/hosting/docker
[d-storage]: https://docs.presenton.ai/self-hosted/configuration/storage-and-processing
[d-auth]: https://docs.presenton.ai/self-hosted/configuration/authentication
[d-embed]: https://docs.presenton.ai/user-guide/managing-presentations/embed-presentation-preview
[d-export]: https://docs.presenton.ai/user-guide/managing-presentations/export-presentations
[d-export-ts]: https://docs.presenton.ai/troubleshooting/editing-and-export
[d-hosting-ts]: https://docs.presenton.ai/troubleshooting/hosting
[d-tplcreate]: https://docs.presenton.ai/user-guide/template-creation
[d-status]: https://docs.presenton.ai/api-reference/presentation/get-generation-status
[r-web]: https://render.com/docs/web-services
[r-private]: https://render.com/docs/private-services
[r-privnet]: https://render.com/docs/private-network
[r-disks]: https://render.com/docs/disks
[r-free]: https://render.com/docs/free
[r-image]: https://render.com/docs/deploying-an-image
[r-docker]: https://render.com/docs/docker
[r-iprules]: https://render.com/docs/inbound-ip-rules
[r-compute]: https://render.com/docs/compute-plans
[r-pricing]: https://render.com/pricing
[r-vs-vercel]: https://render.com/docs/render-vs-vercel-comparison

- Repo and releases: [commit 4e9d853][commit], [v0.9.11-beta release][rel], [GHCR package][ghcr], [presenton-export][presenton-export]
- Repo files: [README][src-readme], [Dockerfile][src-dockerfile], [nginx.conf][src-nginx], [start.js][src-start], [package.json][src-pkg], [LICENSE][src-license], [NOTICE][src-notice], [docker-release.yml][src-release-wf], [docs/presenton-resource-usage.md][src-resource], [docs/presentation-generation-modes.md][src-modes], [docs/template-v2.md][src-tplv2]
- FastAPI: [presentation.py][src-pres], [slide.py][src-slide], [template.py][src-template], [middlewares.py][src-mw], [auth router][src-auth-router], [principal.py][src-principal], [users.py][src-users], [webhook_service.py][src-webhook-svc], [default_templates.py][src-default-tpl], [elements.py][src-elements], [db_utils.py][src-dbutils], [export_utils.py][src-export-utils]
- Next.js: [next.config.mjs][src-nextconfig], [proxy.ts][src-proxy]
- docs.presenton.ai: [index][d-index], [system requirements][d-sysreq], [Docker][d-docker], [storage and processing][d-storage], [authentication][d-auth], [embed preview][d-embed], [export][d-export], [editing and export troubleshooting][d-export-ts], [hosting troubleshooting][d-hosting-ts], [template creation][d-tplcreate], [get generation status][d-status]
- Render: [web services][r-web], [private services][r-private], [private network][r-privnet], [disks][r-disks], [free instances][r-free], [deploy an image][r-image], [Docker][r-docker], [inbound IP rules][r-iprules], [compute plans][r-compute], [pricing][r-pricing], [Render vs Vercel][r-vs-vercel]
