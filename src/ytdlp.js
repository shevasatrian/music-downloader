// Thin wrapper around yt-dlp (via youtube-dl-exec) + bundled ffmpeg.
// Exposes getInfo() for metadata and downloadAudio() for streaming MP3 extraction.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ytdlpExec from 'youtube-dl-exec';
import ffmpegStatic from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');

// ffmpeg-static gives the absolute path to the bundled binary so yt-dlp can transcode to MP3
// without any system ffmpeg install.
const FFMPEG_PATH = ffmpegStatic;

/**
 * Fetch metadata for a single video without downloading it.
 * @returns {Promise<{title:string, thumbnail:string, duration:number, uploader:string}>}
 */
export async function getInfo(url) {
  const info = await ytdlpExec(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noPlaylist: true,
  });

  return {
    title: info.title,
    thumbnail: info.thumbnail,
    duration: info.duration, // seconds
    uploader: info.uploader || info.channel || '',
  };
}

/**
 * Download + transcode a video's audio to MP3.
 * @param {string} url - YouTube URL
 * @param {string} jobId - unique id used for the temp output filename
 * @param {(percent:number, stage:string)=>void} onProgress - progress callback
 * @returns {Promise<string>} absolute path to the resulting .mp3 file
 */
export function downloadAudio(url, jobId, onProgress) {
  const outputTemplate = path.join(DOWNLOADS_DIR, `${jobId}.%(ext)s`);
  const finalPath = path.join(DOWNLOADS_DIR, `${jobId}.mp3`);

  return new Promise((resolve, reject) => {
    // Raw exec() returns a child process (execa) whose stdout we parse for progress.
    const subprocess = ytdlpExec.exec(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0, // best
      ffmpegLocation: FFMPEG_PATH,
      output: outputTemplate,
      noPlaylist: true,
      noWarnings: true,
      newline: true,
      // Emit a clean, parseable percentage on the download stage.
      progressTemplate: 'download:%(progress._percent_str)s',
    });

    let stderr = '';

    const handleLine = (line) => {
      const text = line.trim();
      if (!text) return;

      // Our custom template lines look like: "download:  47.3%"
      const m = text.match(/download:\s*([\d.]+)%/i);
      if (m) {
        onProgress(parseFloat(m[1]), 'downloading');
        return;
      }
      // ffmpeg post-processing stage.
      if (/\[ExtractAudio\]|Destination:|Deleting original file/i.test(text)) {
        onProgress(100, 'converting');
      }
    };

    let stdoutBuf = '';
    subprocess.stdout?.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split(/\r\n|\r|\n/);
      stdoutBuf = lines.pop() ?? '';
      lines.forEach(handleLine);
    });

    subprocess.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    subprocess.on('error', reject);

    subprocess.on('close', (code) => {
      if (stdoutBuf) handleLine(stdoutBuf);
      if (code === 0) {
        resolve(finalPath);
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
    });
  });
}
