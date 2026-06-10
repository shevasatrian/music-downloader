# 🎵 YouTube → MP3 Downloader

A simple web app: paste a YouTube link, preview the track (title, thumbnail, duration), and
download the audio as an MP3 for offline listening.

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

## How it works

- `POST /api/info` — returns video metadata (title, thumbnail, duration, uploader).
- `GET /api/download?url=...` — a Server-Sent Events stream that runs yt-dlp + ffmpeg, emits
  `progress` events, then a `done` event with a one-time download token.
- `GET /api/file?token=...` — serves the finished MP3 as a download, then deletes the temp file.
  Abandoned files are swept after 10 minutes, and any leftovers are cleared on server startup.

## Note on usage

Use this for content you have the right to download (e.g. Creative Commons / public-domain audio,
or your own uploads). Downloading copyrighted material may violate YouTube's Terms of Service.
