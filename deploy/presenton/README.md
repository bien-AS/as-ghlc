# Deploy Presenton on Render

For whoever holds the Authority Solutions Render account. About 20 minutes. You need no access to our code: Render runs Presenton's public image, pinned to an exact version.

Presenton is the open-source deck generator the AS Sales App calls to build a deck for each lead. Why each setting is what it is: `docs/research/presenton-on-render.md` and `docs/specs/09-decks-presenton.md` in the app repo.

## Before you start

Have these ready. Keep every secret in the team's password manager, never in chat or email.

- **An OpenRouter API key** (the company key the app uses). Ask Zachery if you do not have it.
- **An admin username and a strong password for Presenton** that you make up now (20+ random characters). They must be set **before the first deploy**: until an admin exists, Presenton lets whoever reaches it first make themselves admin.

## 1. Create the service

Render dashboard → **New** → **Web Service** → **Existing Image**.

| Field               | Value                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Image URL           | `ghcr.io/presenton/presenton:v0.9.11-beta@sha256:ddf0d1f26397764856acdf94489dbbae5a2c0644a280723fd80bc7a80de338ba` |
| Registry credential | None (the image is public)                                                                                         |
| Name                | `as-presenton`                                                                                                     |
| Region              | The one nearest the app's Supabase project                                                                         |
| Instance type       | **2 CPU, 8 GB RAM**. 2 CPU, 4 GB is the minimum; Presenton's own tests spike far above 4 GB                        |

The `@sha256:...` part pins the exact build, so nothing changes under us until we choose to upgrade.

## 2. Add the disk (before the first deploy)

**Advanced** → **Add Disk**:

| Field      | Value            |
| ---------- | ---------------- |
| Name       | `presenton-data` |
| Mount path | `/app_data`      |
| Size       | 20 GB            |

Without the disk every deploy wipes the admin account, the API keys, the templates and every deck. A disk also means one instance and a short pause on each deploy; that is expected.

## 3. Environment variables (before the first deploy)

**Environment** → add each one. Mark the three secrets as secret.

| Key                            | Value                                 |
| ------------------------------ | ------------------------------------- |
| `PORT`                         | `80`                                  |
| `AUTH_USERNAME`                | the admin username you chose (secret) |
| `AUTH_PASSWORD`                | the admin password you chose (secret) |
| `LLM`                          | `openrouter`                          |
| `OPENROUTER_API_KEY`           | the OpenRouter key (secret)           |
| `OPENROUTER_MODEL`             | `anthropic/claude-sonnet-5.5`         |
| `OPENROUTER_DATA_COLLECTION`   | `deny`                                |
| `OPENROUTER_ZDR`               | `true`                                |
| `PRESENTATION_GENERATION_MODE` | `standard`                            |
| `DISABLE_IMAGE_GENERATION`     | `true`                                |
| `MEM0_ENABLED`                 | `false`                               |
| `PRESENTON_COMMUNITY_ENABLED`  | `false`                               |
| `DISABLE_ANONYMOUS_TRACKING`   | `true`                                |

**Never add `DISABLE_AUTH`.** It switches off every login and key check.

`PRESENTON_PUBLIC_URL` comes in step 5, once the service has its address.

## 4. Health check and deploy

**Settings** → **Health Check Path**: `/api/v1/auth/status`

Then **Deploy**. The first boot takes a few minutes (it checks its export runtime, sets up its database and loads templates). Note roughly how long it took; we have no published figure.

## 5. Set the public address

Copy the service's address (for example `https://as-presenton.onrender.com`, or a custom domain if you add one). Add:

| Key                    | Value                                               |
| ---------------------- | --------------------------------------------------- |
| `PRESENTON_PUBLIC_URL` | that address, with `https://` and no trailing slash |

Save; Render redeploys.

## 6. Check it and make the app's key

1. Open the address. You should see Presenton's sign-in, **not** a setup screen. If you see a setup screen, the admin variables were not picked up: stop and tell Bien.
2. Sign in with the admin username and password.
3. **Admin** → **API keys** → create a key labelled `as-sales-app`, with the longest expiry offered (up to 365 days). Copy it once; it starts with `sk-presenton-`.
4. Note the expiry date in the team calendar; the app stops making decks when it lapses.

## 7. Smoke test (optional, about 2 minutes)

From any terminal, with the address and key in place of the placeholders:

```bash
curl -s -X POST "https://YOUR-ADDRESS/api/v1/ppt/presentation/generate" -H "Authorization: Bearer sk-presenton-YOUR-KEY" -H "Content-Type: application/json" -d '{"content":"A five-slide discovery call deck for a local dental practice that wants more new patients.","n_slides":5,"template":"general","export_as":"pdf"}'
```

It answers with a `presentation_id` and a `path` to the PDF once the deck is built (this call waits for it). An error naming the model or OpenRouter means the key or model id is wrong.

## 8. Send back to Bien

Through the password manager:

- the address,
- the `sk-presenton-…` key and its expiry date,
- the admin username and password, shared with Bien and Zachery,
- how long the first boot took, and whether the smoke test worked.

## Later, not now

- **Our three templates** (Discovery Call, Follow Up, Strategy Session) and the Poppins font are added once Mitchell and Zachery's decks arrive. That changes the service to build from a small Dockerfile in the app repo; Bien will say when.
- **Upgrades** are deliberate: Presenton is still in beta, so a new version is tested before the pin moves.
