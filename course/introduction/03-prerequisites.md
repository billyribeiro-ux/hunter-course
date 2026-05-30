# Introduction — Prerequisites & Environment

> 15 minutes now, zero headaches later.

## 1. Install the toolchain

### Node.js 22.15 LTS

We pin the runtime so your local dev matches CI exactly.

The cleanest way is **fnm** (fast, cross-platform):

```bash
# macOS / Linux
curl -fsSL https://fnm.vercel.app/install | bash
exec $SHELL
fnm install 22.15.0
fnm default 22.15.0
```

On Windows, use [Volta](https://volta.sh/) or the official installer.

Verify:
```bash
node -v
# v22.15.0
```

### pnpm 11.5

`pnpm` is faster, disk-efficient, and deterministic. We'll use its lockfile in CI.

```bash
corepack enable
corepack use pnpm@11.5.0
pnpm -v
# 11.5.0
```

### Git

You almost certainly have it. Check:
```bash
git --version
```

### Docker Desktop

Supabase local runs Postgres, PostgREST, GoTrue, Realtime, Inbucket (mock SMTP), and more — all as Docker containers. You need Docker running to `supabase start`.

- Mac / Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Linux: Docker Engine + docker-compose plugin

Verify:
```bash
docker info | head -5
```

### VS Code extensions (recommended)

Open VS Code, then install:

- **Svelte for VS Code** (`svelte.svelte-vscode`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Prettier** (`esbenp.prettier-vscode`)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Supabase** (`supabase.vscode-supabase-extension`)

We'll commit a `.vscode/extensions.json` later so teammates get prompted to install them.

## 2. Create the accounts

### Supabase

1. Sign up at [supabase.com](https://supabase.com). Free tier is fine.
2. We'll create a project in Module 12. For now, just verify you can log in.

### Stripe

1. Sign up at [stripe.com](https://stripe.com). You do not need to "activate" your account; test mode is enabled by default.
2. After signup, stay in **test mode** (toggle in the top-right of the dashboard).
3. Go to [Developers → API keys](https://dashboard.stripe.com/test/apikeys) and note that your secret key starts with `sk_test_…`. We'll copy it later.

### Vercel

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. Free hobby plan is plenty.

### GitHub

You need a GitHub account with SSH keys set up for `git push`. If not:
```bash
ssh-keygen -t ed25519 -C "you@example.com"
# Add the .pub file to GitHub → Settings → SSH keys
```

## 3. Pick a working directory

Somewhere you'll remember:

```bash
mkdir -p ~/code
cd ~/code
```

All subsequent commands assume you're inside `~/code` or the project folder we're about to create.

## 4. Keep two terminals open

Because Supabase and the Stripe webhook forwarder both run in the foreground, we'll spend most of the course with **two or three terminal tabs** open simultaneously. Label them in your head:

- **T1**: SvelteKit dev server (`pnpm dev`)
- **T2**: Supabase (`pnpm supabase:start` once, then just leave it)
- **T3**: Stripe listen (`pnpm stripe:listen`, Modules 5+)

## Done?

Run this sanity check:
```bash
node -v && pnpm -v && git --version && docker info | head -1
```

If all four print without error, you're ready.

Next: [How to get help →](./04-how-to-get-help.md)
