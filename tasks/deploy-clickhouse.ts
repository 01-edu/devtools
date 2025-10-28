import { parseArgs } from 'jsr:@std/cli/parse-args'

const args = parseArgs(Deno.args, {
  string: ['env', 'action'],
  boolean: ['help', 'force'],
  default: { env: 'dev', action: 'start' },
})

if (args.help) {
  console.log(`
Usage: deno task clickhouse:deploy [options]

Options:
  --env <env>         Environment (dev, prod, test) [default: dev]
  --action <action>   Action (start, stop, restart, remove, status, logs) [default: start]
  --force            Force action without confirmation
  --help             Show this help message

Examples:
  deno task clickhouse:deploy                     # Start ClickHouse dev
  deno task clickhouse:deploy --action=stop       # Stop ClickHouse
  deno task clickhouse:deploy --env=prod          # Deploy prod ClickHouse
  deno task clickhouse:deploy --action=remove --force  # Remove without confirmation
  deno task clickhouse:deploy --action=logs       # Show container logs
`)
  Deno.exit(0)
}

const env = args.env
const action = args.action
const force = args.force
const CLICKHOUSE_USER = Deno.env.get('CLICKHOUSE_USER') || ''
const CLICKHOUSE_PASSWORD = Deno.env.get('CLICKHOUSE_PASSWORD') || ''

if (env === 'prod' && (!CLICKHOUSE_USER || !CLICKHOUSE_PASSWORD)) {
  console.error(
    `❌ Missing environment variables for production: CLICKHOUSE_USER, CLICKHOUSE_PASSWORD`,
  )
  Deno.exit(1)
}

const containerName = `clickhouse-${env}`
const networkName = `devtools-${env}`

type ClickHouseConfig = {
  httpPort: number
  tcpPort: number
  user: string
  password: string
  database: string
  dataPath: string
}

const configs: Record<string, ClickHouseConfig> = {
  dev: {
    httpPort: 8123,
    tcpPort: 9000,
    user: 'dev_user',
    password: 'dev_password',
    database: 'devtools_dev',
    dataPath: './db/clickhouse-dev',
  },
  prod: {
    httpPort: 8124,
    tcpPort: 9001,
    user: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
    database: 'devtools_prod',
    dataPath: './db/clickhouse-prod',
  },
  test: {
    httpPort: 8125,
    tcpPort: 9002,
    user: 'test_user',
    password: 'test_password',
    database: 'devtools_test',
    dataPath: './db/clickhouse-test',
  },
} as const

const config = configs[env]
if (!config) {
  console.error(`❌ Unknown environment: ${env}`)
  Deno.exit(1)
}

async function runCommand(
  cmd: string[],
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const process = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: 'piped',
      stderr: 'piped',
    })

    const result = await process.output()
    const output = new TextDecoder().decode(result.stdout)

    if (!result.success) {
      const error = new TextDecoder().decode(result.stderr)
      return { success: false, output, error }
    }

    return { success: true, output }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, output: '', error: errorMessage }
  }
}

async function containerExists(name: string): Promise<boolean> {
  const result = await runCommand(['docker', 'inspect', name])
  return result.success
}

async function containerRunning(name: string): Promise<boolean> {
  const result = await runCommand([
    'docker',
    'inspect',
    '-f',
    '{{.State.Running}}',
    name,
  ])
  return result.success && result.output.trim() === 'true'
}

async function networkExists(name: string): Promise<boolean> {
  const result = await runCommand(['docker', 'network', 'inspect', name])
  return result.success
}

async function createNetwork(): Promise<void> {
  if (await networkExists(networkName)) {
    console.log(`🌐 Network ${networkName} already exists`)
    return
  }

  console.log(`🌐 Creating network ${networkName}...`)
  const result = await runCommand(['docker', 'network', 'create', networkName])

  if (!result.success) {
    console.log(`⚠️  Failed to create network: ${result.error}`)
  }
}

async function cleanDataDirectory(): Promise<void> {
  if (!force) {
    const confirmation = prompt(
      `⚠️  This will delete all ClickHouse data for ${env}. Continue? (y/N): `,
    )
    if (confirmation?.toLowerCase() !== 'y') {
      console.log('❌ Operation cancelled')
      return
    }
  }

  console.log(`🧹 Cleaning data directory ${config.dataPath}...`)

  try {
    const result = await runCommand(['sudo', 'rm', '-rf', config.dataPath])

    if (result.success) {
      console.log(`✅ Data directory cleaned`)
    } else {
      console.log(`⚠️  Trying alternative cleanup method...`)

      const chownResult = await runCommand([
        'sudo',
        'chown',
        '-R',
        `${Deno.uid()}:${Deno.gid()}`,
        config.dataPath,
      ])

      if (chownResult.success) {
        await Deno.remove(config.dataPath, { recursive: true })
        console.log(`✅ Data directory cleaned (with sudo)`)
      } else {
        console.log(`❌ Could not clean data directory. Please run manually:`)
        console.log(`   sudo rm -rf ${config.dataPath}`)
      }
    }
  } catch (error) {
    console.log(`❌ Error cleaning data directory: ${error}`)
    console.log(`ℹ️  You may need to run: sudo rm -rf ${config.dataPath}`)
  }
}

async function cleanupResources(): Promise<void> {
  console.log(`🧹 Cleaning up resources for ${env}...`)

  if (await containerExists(containerName)) {
    console.log(`🛑 Stopping container ${containerName}...`)
    await runCommand(['docker', 'stop', containerName])

    console.log(`🗑️  Removing container ${containerName}...`)
    await runCommand(['docker', 'rm', containerName])
  }

  await new Promise((resolve) => setTimeout(resolve, 1000))
}

async function startClickHouse(): Promise<void> {
  console.log(`🚀 Starting ClickHouse for ${env} environment...`)

  await createNetwork()

  if (await containerExists(containerName)) {
    if (await containerRunning(containerName)) {
      console.log(`✅ Container ${containerName} is already running`)
      return
    } else {
      console.log(`🔄 Removing existing stopped container...`)
      await runCommand(['docker', 'rm', containerName])
    }
  }

  console.log(`📁 Data will be stored in: ${config.dataPath}`)

  const dockerCmd = [
    'docker',
    'run',
    '-d',
    '--name',
    containerName,
    '-p',
    `${config.httpPort}:8123`,
    '-p',
    `${config.tcpPort}:9000`,
    '-v',
    `${Deno.cwd()}/${config.dataPath}:/var/lib/clickhouse`,
    '-e',
    `CLICKHOUSE_DB=${config.database}`,
    '-e',
    `CLICKHOUSE_USER=${config.user}`,
    '-e',
    `CLICKHOUSE_PASSWORD=${config.password}`,
    '-e',
    `CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1`,
    '--ulimit',
    'nofile=262144:262144',
    'clickhouse/clickhouse-server:latest',
  ]

  if (await networkExists(networkName)) {
    dockerCmd.splice(3, 0, '--network', networkName)
  }

  console.log(`🐳 Creating ClickHouse container...`)
  const result = await runCommand(dockerCmd)

  if (!result.success) {
    console.error(`❌ Failed to create container: ${result.error}`)
    return
  }

  console.log(`⏳ Waiting for ClickHouse to start...`)
  let attempts = 0
  const maxAttempts = 15

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    attempts++

    if (await containerRunning(containerName)) {
      console.log(`✅ ClickHouse ${env} started successfully`)
      console.log(`📊 HTTP: http://localhost:${config.httpPort}`)
      console.log(`🔌 TCP: localhost:${config.tcpPort}`)
      console.log(`👤 User: ${config.user}`)
      console.log(`🗄️  Database: ${config.database}`)

      try {
        const response = await fetch(
          `http://localhost:${config.httpPort}/ping`,
          {
            signal: AbortSignal.timeout(5000),
          },
        )
        if (response.ok) {
          console.log(`🟢 ClickHouse is responding to requests`)
        }
      } catch {
        console.log(
          `⚠️  ClickHouse container started but may still be initializing...`,
        )
      }
      return
    }

    console.log(`⏳ Still waiting... (${attempts}/${maxAttempts})`)
  }

  console.log(`❌ Container failed to start properly. Check logs:`)
  await showLogs()
}

async function stopClickHouse(): Promise<void> {
  console.log(`🛑 Stopping ClickHouse ${env}...`)

  if (!await containerExists(containerName)) {
    console.log(`ℹ️  Container ${containerName} does not exist`)
    return
  }

  if (!await containerRunning(containerName)) {
    console.log(`ℹ️  Container ${containerName} is already stopped`)
    return
  }

  const result = await runCommand(['docker', 'stop', containerName])

  if (result.success) {
    console.log(`✅ ClickHouse ${env} stopped`)
  } else {
    console.log(`⚠️  Error stopping container: ${result.error}`)
  }
}

async function restartClickHouse(): Promise<void> {
  console.log(`🔄 Restarting ClickHouse ${env}...`)
  await stopClickHouse()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await startClickHouse()
}

async function removeClickHouse(): Promise<void> {
  if (!force) {
    const confirmation = prompt(
      `⚠️  Remove ClickHouse ${env} container? Data in ${config.dataPath} will be preserved. (y/N): `,
    )
    if (confirmation?.toLowerCase() !== 'y') {
      console.log('❌ Operation cancelled')
      return
    }
  }

  await cleanupResources()
  console.log(
    `✅ ClickHouse ${env} removed (data preserved in ${config.dataPath})`,
  )
  console.log(
    `ℹ️  To clean data directory, run: deno task clickhouse:deploy --action=clean --env=${env}`,
  )
}

async function showStatus(): Promise<void> {
  console.log(`📊 ClickHouse ${env} Status:`)

  if (!await containerExists(containerName)) {
    console.log(`❌ Container ${containerName} does not exist`)
    console.log(
      `ℹ️  Run 'deno task clickhouse:deploy --env=${env}' to create it`,
    )
    return
  }

  const running = await containerRunning(containerName)
  console.log(`🔹 Container: ${containerName}`)
  console.log(`🔹 Status: ${running ? '🟢 Running' : '🔴 Stopped'}`)
  console.log(`🔹 HTTP Port: ${config.httpPort}`)
  console.log(`🔹 TCP Port: ${config.tcpPort}`)
  console.log(`🔹 Database: ${config.database}`)
  console.log(`🔹 User: ${config.user}`)
  console.log(`🔹 Data Path: ${config.dataPath}`)

  if (!running) {
    console.log(
      `ℹ️  Run 'deno task clickhouse:deploy --env=${env}' to start it`,
    )
  }
}

async function showLogs(): Promise<void> {
  console.log(`📝 ClickHouse ${env} Logs:`)

  if (!await containerExists(containerName)) {
    console.log(`❌ Container ${containerName} does not exist`)
    return
  }

  const result = await runCommand([
    'docker',
    'logs',
    '--tail',
    '50',
    containerName,
  ])

  if (result.success) {
    console.log(result.output)
  } else {
    console.log(`⚠️  Could not fetch logs: ${result.error}`)
  }
}

try {
  switch (action) {
    case 'start':
      await startClickHouse()
      break
    case 'stop':
      await stopClickHouse()
      break
    case 'restart':
      await restartClickHouse()
      break
    case 'remove':
      await removeClickHouse()
      break
    case 'clean':
      await cleanDataDirectory()
      break
    case 'status':
      await showStatus()
      break
    case 'logs':
      await showLogs()
      break
    default:
      console.error(`❌ Unknown action: ${action}`)
      Deno.exit(1)
  }
} catch (error) {
  console.error(`❌ Deployment failed: ${error}`)
  Deno.exit(1)
}
