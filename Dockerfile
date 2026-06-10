# Container image for deploying the app to Hugging Face Spaces (Docker SDK).
FROM node:22-bookworm-slim

# yt-dlp's npm installer checks for Python, but the binary it downloads is a
# standalone bundle that needs no Python at runtime — so skip the check.
# Hugging Face Spaces route external traffic to port 7860 by default.
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1 \
    NODE_ENV=production \
    PORT=7860

# Hugging Face Spaces run containers as user id 1000; set that up so the app
# can write its temp downloads/ dir.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user
WORKDIR /home/user/app

# Install dependencies first for better layer caching. The postinstall steps
# fetch the Linux yt-dlp and ffmpeg-static binaries.
COPY --chown=user:user package.json package-lock.json ./
RUN npm ci

# Copy the application source.
COPY --chown=user:user . .

EXPOSE 7860
CMD ["node", "server.js"]
