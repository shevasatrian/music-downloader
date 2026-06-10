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

  const params = new URLSearchParams({ url: currentUrl, format });
  if (format === 'video') params.set('quality', qualitySelect.value);

  const source = new EventSource(`/api/download?${params.toString()}`);
  activeSource = source;

  source.addEventListener('progress', (e) => {
    const { percent, stage } = JSON.parse(e.data);
    if (stage === 'converting') {
      progressFill.style.width = '100%';
      progressLabel.textContent = processingLabel;
    } else {
      progressFill.style.width = `${percent}%`;
      progressLabel.textContent = `Downloading… ${percent.toFixed(1)}%`;
    }
  });

  source.addEventListener('done', (e) => {
    const { token } = JSON.parse(e.data);
    progressFill.style.width = '100%';
    progressLabel.textContent = 'Done! Saving file…';
    // Trigger the browser save dialog.
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
    source.close();
    activeSource = null;
    downloadButtons.forEach((b) => (b.disabled = false));
  }
}
