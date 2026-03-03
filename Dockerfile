FROM node:22-slim

ENV TZ=Asia/Seoul
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Install Playwright Chromium with system dependencies
RUN npx playwright install --with-deps chromium

# Copy application source
COPY src/ src/
COPY scripts/ scripts/
COPY tsconfig.json ./

# Persistent cookie storage
VOLUME /app/cookies

ENTRYPOINT ["npx", "tsx", "src/index.ts"]
CMD ["api-attend"]
