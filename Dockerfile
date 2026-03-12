# === Build stage: typecheck ===
FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY src/ src/
COPY scripts/ scripts/
COPY tsconfig.json ./
RUN npx tsc --noEmit

# === Runtime stage ===
FROM node:22-slim

ENV TZ=Asia/Seoul
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Install Playwright Chromium with system dependencies
RUN npx playwright install --with-deps chromium

# Copy application source (verified by build stage)
COPY --from=build /app/src/ src/
COPY --from=build /app/scripts/ scripts/
COPY --from=build /app/tsconfig.json ./

# Persistent cookie storage
VOLUME /app/cookies

# HTTP service port (used by 'server' command)
EXPOSE 8080

ENTRYPOINT ["npx", "tsx", "src/index.ts"]
CMD ["api-attend"]
