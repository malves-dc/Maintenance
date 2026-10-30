# VillaOps CMMS — production image (Next.js standalone server + Prisma migrations).
# Build: docker build -t maintenance .   Run: see docker-compose.yml

# Alpine (musl): far fewer system packages than Debian (no glibc, systemd, perl, apt…), so fewer CVEs to carry.
# Keep the ffmpeg stage on the same Alpine release so its x264/dav1d libraries match the runtime ones.
FROM node:24-alpine3.24 AS base
# Alpine security updates on every build; the release workflow skips the cache here.
RUN apk upgrade --no-cache && apk add --no-cache openssl ca-certificates
WORKDIR /app

# ── Dependencies (postinstall runs `prisma generate`, which needs the schema)
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ── Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ── Prisma CLI for `migrate deploy` at start-up (kept apart from the traced app bundle)
FROM base AS migrator
WORKDIR /migrator
RUN npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund prisma@7.10.1 dotenv@18.0.4

# ── ffmpeg for video uploads (lib/video.ts), built with only what the app uses: every built-in decoder and
# demuxer (any phone video), libdav1d for AV1, libx264 + AAC + MJPEG encoders, MP4/JPEG output. The distro's
# own ffmpeg package pulls in many libraries (X11, Mesa, audio servers…) that only add vulnerabilities.
# Update FFMPEG_VERSION and FFMPEG_SHA256 together (sha256 of the .tar.xz from ffmpeg.org/releases, whose
# .asc signature is checked against the FFmpeg release key FCF9 86EA 15E6 E293 A564 4F10 B432 2F04 D676 58D8).
FROM alpine:3.24 AS ffmpeg
ARG FFMPEG_VERSION=7.1.5
ARG FFMPEG_SHA256=de668509caf9e35e3cd162473441fdb29538c6d96ed080292b3cf9e6fc5d558f
RUN apk add --no-cache ca-certificates curl xz tar build-base nasm pkgconf x264-dev dav1d-dev
WORKDIR /src
RUN curl -fsSL -o ffmpeg.tar.xz "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" \
 && echo "${FFMPEG_SHA256}  ffmpeg.tar.xz" | sha256sum -c - \
 && tar -xJf ffmpeg.tar.xz --strip-components=1 \
 && ./configure --prefix=/opt/ffmpeg --enable-gpl --enable-libx264 --enable-libdav1d \
      --disable-autodetect --disable-network --disable-debug --disable-doc --disable-ffplay \
      --disable-devices --disable-hwaccels \
      --disable-encoders --enable-encoder=libx264,aac,mjpeg \
      --disable-muxers --enable-muxer=mp4,mov,image2 \
 && make -j"$(nproc)" && make install && strip /opt/ffmpeg/bin/*

# ── System tools the app runs, shared by the runtime and development images
FROM base AS system
# PostgreSQL 18 client tools (pg_dump/pg_restore/psql) for backups; they work with servers up to 18.
# Backups use busybox tar. x264 / dav1d libraries for the ffmpeg built above.
RUN apk add --no-cache postgresql18-client x264-libs libdav1d
COPY --from=ffmpeg /opt/ffmpeg/bin/ffmpeg /opt/ffmpeg/bin/ffprobe /usr/local/bin/

# ── Development (docker-compose.dev.yml): the runtime's tools plus npm, running `next dev` on the bind-mounted repo
FROM system AS dev
COPY docker/restart-dev.sh /usr/local/bin/restart-dev
RUN chmod +x /usr/local/bin/restart-dev

# ── Runtime
FROM system AS runner
# The server runs with plain `node`; drop npm/npx/corepack/yarn so their bundled packages (undici,
# brace-expansion…) aren't shipped.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    APP_RUNTIME=docker \
    BACKUP_DIR=/backups \
    MIGRATIONS_DIR=/migrator/prisma/migrations \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    UPLOAD_DIR=/data/uploads \
    AUTH_TRUST_HOST=true \
    SCHEDULER_INTERVAL_MINUTES=15 \
    NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=migrator /migrator/node_modules /migrator/node_modules
COPY prisma /migrator/prisma
COPY prisma.config.ts /migrator/
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /data/uploads /backups && chown -R node:node /data /backups
USER node
VOLUME ["/data", "/backups"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
