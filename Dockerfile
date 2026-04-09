# Stage 1: Builder
FROM denoland/deno:latest AS builder
WORKDIR /app

# Copy lock
COPY ./deno.json /app/deno.json
COPY ./deno.lock /app/deno.lock

# Install dependencies
RUN deno install

# Build frontend (dist/web) and compile backend with static files
COPY ./tasks/vite.ts /app/tasks/vite.ts
COPY ./web /app/web
RUN deno cache --allow-scripts --lock=deno.lock tasks/vite.ts web/index.tsx
ENV BASE_URL="/"
RUN deno task prod:vite

# Build API
COPY ./api  /app/api
COPY ./db /app/db
RUN deno cache --allow-scripts --lock=deno.lock api/server.ts
RUN deno task prod:api

# Stage 2: Final image
FROM debian:bookworm-slim
WORKDIR /app

# Copy compiled executable and Deno cache
COPY --from=builder /app/dist/api /app/server
COPY --from=builder /app/db/functions /app/db/functions

# Expose port from .env.prod (3021)
EXPOSE 3021

# Run the compiled executable
CMD ["/app/server", "--env=prod"]
