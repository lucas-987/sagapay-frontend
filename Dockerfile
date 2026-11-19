FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "pnpm@$(node -p 'require("./package.json").packageManager.split("@").at(-1)')" \
    && pnpm install --frozen-lockfile

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN pnpm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /srv/sagapay

USER nginx
EXPOSE 8080
ENTRYPOINT ["/usr/sbin/nginx"]
CMD ["-g", "daemon off;"]
