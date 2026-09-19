# Deploying the BarCamp orders board

Zero dependencies, so there's nothing to `npm install`. Pick whichever of
these fits.

## Run it locally (no npx, no build step)

```sh
PORT=3000 node server.js
```

Then open http://localhost:3000. Orders persist to `data/orders.json` next
to `server.js`.

## Option 1: Docker

```sh
docker build -t barcamp-orders .
docker run -p 3000:3000 -v barcamp-data:/app/data barcamp-orders
```

The named volume (`barcamp-data`) keeps `data/orders.json` across container
restarts and rebuilds. Open http://localhost:3000.

## Option 2: Render.com

This repo includes `render.yaml` (a "Blueprint"). In the Render dashboard:
New -> Blueprint -> point it at this repo -> Apply.

It creates a Node web service that runs `node server.js` with a 1GB disk
mounted at `/opt/render/project/src/data`, so orders survive deploys.
(Persistent disks require a paid instance type, not the free plan — bump
`plan:` in `render.yaml` if needed.)

## Option 3: Fly.io

```sh
fly launch --copy-config --no-deploy   # uses fly.toml, creates the app
fly volumes create barcamp_data --size 1
fly deploy
```

`fly.toml` mounts a `barcamp_data` volume at `/app/data` and exposes port
3000 over HTTP/HTTPS, with a health check on `/api/state`.
