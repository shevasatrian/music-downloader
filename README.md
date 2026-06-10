---
title: Music Downloader
emoji: 🎵
colorFrom: red
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
---

# 🎵 YouTube → MP3 Downloader

A simple web app: paste a YouTube link, preview it (title, thumbnail, duration), then download
either the **audio as an MP3** or the **video as an MP4** at a chosen quality (Best / 1080p / 720p).

Video downloads prefer **H.264 + AAC** so the resulting MP4 plays natively in Windows Media Player
and other basic players. Because YouTube only serves resolutions above 1080p as VP9/AV1 (which many
players can't decode), "Best" means the best *compatible* quality — effectively up to 1080p.

Built with **Node.js + Express**, using **yt-dlp** (bundled binary) and a **bundled static ffmpeg**
for audio extraction — no system-wide yt-dlp/ffmpeg/Python install required.

## Setup

```bash
npm install
```

> **Note:** `youtube-dl-exec`'s installer runs a check for a real Python interpreter. The bundled
> `yt-dlp.exe` is standalone and does **not** need Python at runtime, so this check is safe to skip.
> If `npm install` fails with "youtube-dl-exec needs Python", set the documented skip flag:
>
> - PowerShell: `$env:YOUTUBE_DL_SKIP_PYTHON_CHECK = "1"; npm install`
> - bash: `YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm install`

## Run

```bash
npm start
```

Then open <http://localhost:3000>. Set a custom port with the `PORT` env var.

## Deploy to Hugging Face Spaces (free, permanent URL, auto-deploy)

This repo is set up to deploy as a **Docker Space** on Hugging Face — a free, permanent
`https://<user>-<space>.hf.space` URL with no domain or credit card required. The included
`Dockerfile` and `app_port: 7860` in the YAML header above configure the Space, and the GitHub
Action in `.github/workflows/deploy-hf.yml` mirrors every push to `main` into the Space, which then
rebuilds and redeploys automatically.

One-time setup:

1. Create a free Hugging Face account and a **Docker** Space.
2. Create a **write** access token (Settings → Access Tokens).
3. In the GitHub repo, add a secret `HF_TOKEN` and variables `HF_USERNAME` / `HF_SPACE`
   (Settings → Secrets and variables → Actions).
4. Push to `main` — the Action syncs to the Space and it builds.

> **Heads up:** Hugging Face runs in a datacenter, so YouTube may occasionally block downloads from
> the Space's IP. Free Spaces also sleep after inactivity and wake on the next visit.

## Sharing it publicly (Cloudflare Tunnel — free, no card)

This app needs a real OS process (it runs the `yt-dlp` and `ffmpeg` binaries), so it can't run on
serverless hosts like Cloudflare Pages/Workers or Vercel. The simplest free way to make it reachable
from anywhere is a **Cloudflare Quick Tunnel**, which exposes the app running on *your* machine. It
needs no Cloudflare account, no domain, and no credit card — and because it runs on your home
connection, YouTube is far less likely to block downloads than from a datacenter IP.

1. Install once: `winget install --id Cloudflare.cloudflared`
2. Terminal 1 — start the app: `npm start`
3. Terminal 2 — open the tunnel: `npm run tunnel`

`cloudflared` prints a public URL like `https://<random>.trycloudflare.com` — share that. The app is
reachable only while both your PC and the tunnel are running, and the URL changes each time you start
a new Quick Tunnel. (For a stable custom URL you'd need a free Cloudflare account plus a domain and a
*named* tunnel.)

> **Heads up:** the tunnel makes your downloader publicly accessible — anyone with the URL can use it.
> Only share it with people you trust, and stop the tunnel (Ctrl+C) when you're done.

## How it works

- `POST /api/info` — returns video metadata (title, thumbnail, duration, uploader).
- `GET /api/download?url=...&format=mp3|video&quality=best|1080|720` — a Server-Sent Events stream
  that runs yt-dlp + ffmpeg, emits `progress` events, then a `done` event with a one-time download
  token. `format=mp3` (default) extracts audio; `format=video` downloads H.264+AAC video + audio and
  merges to MP4. `quality` (video only) caps the resolution.
- `GET /api/file?token=...` — serves the finished MP3 as a download, then deletes the temp file.
  Abandoned files are swept after 10 minutes, and any leftovers are cleared on server startup.

## Note on usage

Use this for content you have the right to download (e.g. Creative Commons / public-domain audio,
or your own uploads). Downloading copyrighted material may violate YouTube's Terms of Service.
