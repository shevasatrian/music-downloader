// Frontend logic: fetch metadata, then stream the download with progress via SSE.

const form = document.getElementById('url-form');
const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const message = document.getElementById('message');

const preview = document.getElementById('preview');
const thumb = document.getElementById('thumb');
const titleEl = document.getElementById('title');
const uploaderEl = document.getElementById('uploader');
const durationEl = document.getElementById('duration');
const downloadMp3Btn = document.getElementById('download-mp3');
const downloadVideoBtn = document.getElementById('download-video');
const qualitySelect = document.getElementById('quality');
const downloadButtons = [downloadMp3Btn, downloadVideoBtn];

const progressWrap = document.getElementById('progress-wrap');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

let currentUrl = '';
let activeSource = null;

function setMessage(text) {
  message.textContent = text || '';
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// --- Step 1: fetch metadata -------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  setMessage('');
  preview.classList.add('hidden');
  progressWrap.classList.add('hidden');
  fetchBtn.disabled = true;
  fetchBtn.textContent = 'Fetching…';

  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not fetch video info.');

    currentUrl = url;
    thumb.src = data.thumbnail || '';
    titleEl.textContent = data.title || 'Untitled';
    uploaderEl.textContent = data.uploader || '';
    durationEl.textContent = formatDuration(data.duration);
    preview.classList.remove('hidden');
  } catch (err) {
    setMessage(err.message);
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = 'Fetch';
  }
});

// --- Step 2: download with progress ----------------------------------------
downloadMp3Btn.addEventListener('click', () => startDownload('mp3'));
downloadVideoBtn.addEventListener('click', () => startDownload('video'));

function startDownload(format) {
  if (!currentUrl || activeSource) return;

  setMessage('');
  downloadButtons.forEach((b) => (b.disabled = true));
  progressWrap.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressLabel.textContent = 'Starting…';

  // Label shown during the ffmpeg post-processing stage.
  const processingLabel =
    format === 'video' ? 'Merging video + audio…' : 'Converting to MP3…';

  // The bar only moves forward and reaches 100% only when the file is actually
  // ready: downloading fills 0–90%, post-processing creeps 90→99%, and the
  // 'done' event completes it to 100% and starts the file download.
  let displayed = 0;
  let creepTimer = null;

  const render = (pct) => {
    displayed = Math.min(100, Math.max(displayed, pct));
    progressFill.style.width = `${displayed}%`;
  };

  const params = new URLSearchParams({ url: currentUrl, format });
  if (format === 'video') params.set('quality', qualitySelect.value);

  const source = new EventSource(`/api/download?${params.toString()}`);
  activeSource = source;

  source.addEventListener('progress', (e) => {
    const { percent, stage } = JSON.parse(e.data);
    if (stage === 'converting') {
      // Enter the finishing zone, then creep slowly so a long merge/convert
      // doesn't look frozen — but never reach 100% until 'done'.
      render(90);
      progressLabel.textContent = processingLabel;
      if (!creepTimer) {
        creepTimer = setInterval(() => {
          if (displayed < 99) render(displayed + 1);
        }, 400);
      }
    } else {
      // Downloading: map the real percent into the first 90% of the bar.
      render(percent * 0.9);
      progressLabel.textContent = `Downloading… ${Math.round(displayed)}%`;
    }
  });

  source.addEventListener('done', (e) => {
    const { token } = JSON.parse(e.data);
    render(100);
    progressLabel.textContent = 'Complete — starting download…';
    // File is ready: trigger the browser save dialog.
    window.location = `/api/file?token=${encodeURIComponent(token)}`;
    cleanup();
  });

  source.addEventListener('error', (e) => {
    let msg = 'Download failed.';
    try {
      if (e.data) msg = JSON.parse(e.data).error || msg;
    } catch {
      /* connection-level error */
    }
    setMessage(msg);
    progressWrap.classList.add('hidden');
    cleanup();
  });

  function cleanup() {
    if (creepTimer) clearInterval(creepTimer);
    creepTimer = null;
    source.close();
    activeSource = null;
    downloadButtons.forEach((b) => (b.disabled = false));
  }
}
