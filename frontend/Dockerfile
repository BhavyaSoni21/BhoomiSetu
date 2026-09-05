# Multi-stage build: compile the Vite SPA to static files, then serve them
# with nginx - `vite dev`/`vite preview` are dev tools, not meant for
# production serving.
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite bakes env vars into the built JS at build time, not runtime - so this
# has to be a build ARG (compose passes it via `build.args`), not a plain
# environment variable, which would only affect the container after the
# static files already exist and do nothing.
ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
