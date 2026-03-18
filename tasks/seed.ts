import { insertLogs } from '/api/clickhouse-client.ts'
import {
  DeploymentsCollection,
  type Project,
  ProjectsCollection,
} from '/api/schema.ts'

const projects: Omit<Project, 'createdAt'>[] = [
  {
    slug: 'website-redesign',
    name: 'Website Redesign',
    teamId: 'frontend-devs',
    isPublic: true,
    repositoryUrl: 'https://github.com/example/website',
  },
  {
    slug: 'api-refactor',
    name: 'API Refactor',
    teamId: 'backend-devs',
    isPublic: false,
    repositoryUrl: 'https://github.com/example/api',
  },
  {
    slug: 'design-system',
    name: 'Design System',
    teamId: 'frontend-devs',
    isPublic: true,
    repositoryUrl: 'https://github.com/example/design-system',
  },
]

async function clearCollection(
  collection:
    | typeof ProjectsCollection
    | typeof DeploymentsCollection,
) {
  console.log(`Clearing ${collection.name} collection...`)
  for (const key of collection.keys()) {
    await collection.delete(key)
  }
  console.log(`${collection.name} collection cleared.`)
}

async function seed() {
  console.log('Starting seeding process...')

  // Clear existing data
  await clearCollection(ProjectsCollection)
  await clearCollection(DeploymentsCollection)

  // Seed projects
  console.log('Seeding projects...')
  for (const [_, project] of projects.entries()) {
    await ProjectsCollection.insert(project)
    const url = `${project.slug}.com`
    const deployement = await DeploymentsCollection.insert({
      projectId: project.slug,
      databaseEnabled: false,
      logsEnabled: true,
      sqlEndpoint: undefined,
      sqlToken: undefined,
      url,
      tokenSalt: crypto.randomUUID(),
    })
    const service_instance_id = crypto.randomUUID()
    const now = Date.now() / 1000
    insertLogs(
      deployement.url,
      [...Array(100).keys()].map((n) => ({
        attributes: { a: 'str', bool: true, num: n },
        event_name: `test-log-${n}`,
        severity_number: Math.floor(Math.random() * 24),
        service_instance_id,
        span_id: (now - n) + Math.random(),
        trace_id: (now - n) + Math.random(),
        service_version: 'v2',
        timestamp: (now - n) * 1000,
      })),
    )
  }
  console.log('Projects seeded.')

  console.log('Seeding process completed.')
}

if (import.meta.main) {
  seed().catch((err) => {
    console.error('Seeding failed:', err)
    Deno.exit(1)
  })
}
