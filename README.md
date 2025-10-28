# Dev-Tools

Front-end for loging and db management

## Quick Start

### Prerequisites

- Deno
- Docker

### Environment Setup

Create your environment files:

```bash
# .env.dev
APP_ENV=dev
PORT=3021
PICTURE_DIR=./.picture

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:3021/auth/callback
SECRET=your_jwt_secret

# ClickHouse
CLICKHOUSE_HOST=localhost:8123
CLICKHOUSE_USER=dev_user
CLICKHOUSE_PASSWORD=dev_password
CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1
```

### ClickHouse Setup

#### Development

Start ClickHouse container:

```bash
docker run -d \
  --env-file .env.dev \
  --name clickhouse-dev \
  -p 8123:8123 \
  -p 9000:9000 \
  -v ./db/clickhouse-dev:/var/lib/clickhouse \
  --ulimit nofile=262144:262144 \
  clickhouse/clickhouse-server:latest
```

Test connection:

```bash
curl http://localhost:8123/ping
```

### Development

```bash
# Start development server
deno task dev

# Or with fresh database
deno task dev:with-seed
```

This will start:

- ClickHouse database (port 8123/9000)
- API server (port 3021)
- Vite dev server

### Production

```bash
# Build
deno task prod

# Start production
deno task start:prod
```

### Docker Production

```bash
# Build image
deno task docker:build

# Run container
deno task docker:prod

# View logs
deno task docker:logs
```

### Available Tasks

```bash
deno task fmt           # Format code
deno task lint          # Lint code
deno task test          # Run tests
deno task check         # Type check
deno task all           # Check + lint + test
```

### ClickHouse Management

```bash
# Manual commands
docker stop clickhouse-dev
docker start clickhouse-dev
docker rm clickhouse-dev

# Connect to ClickHouse client
docker exec -it clickhouse-dev clickhouse-client

# Clean data directory (if needed)
sudo rm -rf ./db/clickhouse-dev
```

### Project Structure

```
├── api/                 # Backend API
├── web/                 # Frontend (Preact)
├── tasks/               # Deno tasks
├── db/                  # Database files
```
