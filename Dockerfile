FROM node:bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY ["package.json", "pnpm-lock.yaml", "./"]

# Install pnpm
RUN npm install -g pnpm@9.10.0

# Install dependencies with pnpm
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 8080

CMD ["pnpm", "start"]