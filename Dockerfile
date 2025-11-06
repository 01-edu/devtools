# Stage 1: Builder
FROM denoland/deno:latest AS builder
WORKDIR /app

# Copy project files
COPY ./api  /app/api
COPY ./tasks/vite.js /app/tasks/vite.js
COPY ./deno.json /app/deno.json
COPY ./deno.lock /app/deno.lock
COPY ./web /app/web

# Cache dependencies
RUN deno cache --allow-scripts --lock=deno.lock api/server.ts tasks/vite.js

# Build frontend (dist/web) and compile backend with static files
RUN deno task prod

# Stage 2: Final image
FROM debian:bookworm-slim
WORKDIR /app

# Copy compiled executable and Deno cache
COPY --from=builder /app/dist/api /app/server

# Expose port from .env.prod (3021)
EXPOSE 3021

# Run the compiled executable
CMD ["/app/server", "--env=prod"]