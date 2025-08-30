import {
  ProjectsCollection,
  TeamsCollection,
  UsersCollection,
} from '../api/schema.ts'
import type { Project, Team, User } from '../api/schema.ts'

const users: User[] = [
  {
    userEmail: 'admin@example.com',
    userFullName: 'Admin User',
    userPicture: undefined,
    isAdmin: true,
  },
  {
    userEmail: 'member1@example.com',
    userFullName: 'Member One',
    userPicture: undefined,
    isAdmin: false,
  },
  {
    userEmail: 'member2@example.com',
    userFullName: 'Member Two',
    userPicture: undefined,
    isAdmin: false,
  },
]

const teams: Team[] = [
  {
    teamId: 'frontend-devs',
    teamName: 'Frontend Devs',
    teamMembers: ['admin@example.com', 'member1@example.com'],
  },
  {
    teamId: 'backend-devs',
    teamName: 'Backend Devs',
    teamMembers: ['admin@example.com', 'member2@example.com'],
  },
]

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
    | typeof UsersCollection
    | typeof TeamsCollection
    | typeof ProjectsCollection,
) {
  console.log(`Clearing ${collection.name} collection...`)
  const keys = Array.from(collection.keys())
  for (const key of keys) {
    await collection.delete(key)
  }
  console.log(`${collection.name} collection cleared.`)
}

async function seed() {
  console.log('Starting seeding process...')

  // Clear existing data
  await clearCollection(UsersCollection)
  await clearCollection(TeamsCollection)
  await clearCollection(ProjectsCollection)

  // Seed users
  console.log('Seeding users...')
  for (const user of users) {
    await UsersCollection.insert(user)
  }
  console.log('Users seeded.')

  // Seed teams
  console.log('Seeding teams...')
  for (const team of teams) {
    await TeamsCollection.insert(team)
  }
  console.log('Teams seeded.')

  // Seed projects
  console.log('Seeding projects...')
  for (const project of projects) {
    await ProjectsCollection.insert(project)
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
