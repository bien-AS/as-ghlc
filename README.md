This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Background jobs (Inngest, local only)

Background jobs run on Inngest, which needs a second process beside the app:

```bash
pnpm dev           # terminal 1: the app on http://localhost:3000
pnpm dev:inngest   # terminal 2: the local Inngest Dev Server, pointed at /api/inngest
```

The Dev Server UI is at [http://localhost:8288](http://localhost:8288). No Inngest keys are needed locally.
`INNGEST_DEV=1` comes from the committed [`.env.development`](.env.development), which Next loads only
under `next dev`; without it `/api/inngest` returns 500 and no function registers. If a job never runs,
check terminal 2 for a 500 on `PUT /api/inngest`.

> Never set `INNGEST_DEV` on a deployment: dev mode turns off request signing on `/api/inngest`.
> The route refuses to build when `INNGEST_DEV` and `VERCEL_ENV` are both set. Deployments get
> `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` once Inngest Cloud is set up.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
