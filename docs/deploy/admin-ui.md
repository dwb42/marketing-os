# Admin-UI Deployment Brief

Audience: DevOps agent operating the `marketing-os.b42.io` VPS.

## Summary

A Next.js 15 static-exported SPA lives in `web/`. It needs to be served at
`https://marketing-os.b42.io/admin/*` as a pile of static files, in addition
to the existing Fastify API on `https://marketing-os.b42.io/*`.

The UI is a pure client-side SPA (no Node runtime required for serving).
All API calls hit the same origin, so no CORS issue in production.

## Build

Run on every deploy after `git pull`:

```bash
cd web
npm ci
npm run build
```

This produces a fully self-contained static bundle at `web/out/`. File layout:

```
web/out/
├── index.html                # /admin/
├── index.txt
├── _next/static/...          # hashed JS/CSS assets
├── activity/index.html       # /admin/activity/
├── campaigns/index.html      # /admin/campaigns/
├── …
└── 404.html
```

All internal URLs inside the HTML/JS already include the `/admin` basePath —
this is baked in at build time via `next.config.mjs`.

## Serving

### Option A (preferred): Nginx / Caddy reverse proxy

Mount `web/out/` at `/admin`, and pass through everything else to Fastify:

#### Caddy (`Caddyfile`)

```caddy
marketing-os.b42.io {
    handle_path /admin/* {
        root * /srv/marketing-os/web/out
        try_files {path} {path}/ {path}.html /404.html
        file_server
    }

    handle /admin {
        redir /admin/ permanent
    }

    reverse_proxy localhost:4000
}
```

#### Nginx

```nginx
server {
    server_name marketing-os.b42.io;

    # Admin UI — static
    location /admin/ {
        alias /srv/marketing-os/web/out/;
        try_files $uri $uri/ $uri/index.html /admin/404.html;
    }
    location = /admin {
        return 301 /admin/;
    }

    # Everything else → Fastify
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option B: Serve via Fastify (`@fastify/static`)

If you prefer to keep everything on Fastify, add this to the API server
(not done in code yet — would need a backend PR):

```ts
import staticPlugin from "@fastify/static";
await app.register(staticPlugin, {
  root: path.resolve(process.cwd(), "web/out"),
  prefix: "/admin/",
  decorateReply: false,
});
```

Option A (reverse proxy) is simpler and keeps static asset serving out of
Node — recommended.

## Cache headers

The `_next/static/*` assets are content-hashed, so set aggressive caching:

```nginx
location /admin/_next/static/ {
    alias /srv/marketing-os/web/out/_next/static/;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

The top-level HTML files (`index.html`, etc.) should NOT be cached long —
they reference the hashed assets and change when the app is rebuilt:

```nginx
location ~ ^/admin/.*\.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
}
```

## Verification

After deploy, these should return HTTP 200:

```
curl -I https://marketing-os.b42.io/admin/
curl -I https://marketing-os.b42.io/admin/campaigns/
curl -I https://marketing-os.b42.io/admin/_next/static/...   # any hashed file
curl -I https://marketing-os.b42.io/health                    # API still works
```

Open `https://marketing-os.b42.io/admin/` in a browser. First time: go to
Einstellungen, fill in the Bearer-Token (if the API is in token-mode), pick
a workspace. The UI will then start pulling real data.

## CORS

Not relevant in production (same-origin). For local dev (`http://localhost:3000`)
the API at `marketing-os.b42.io` already has `localhost:3000` in its CORS
allow-list — `src/api/server.ts` handles it.
