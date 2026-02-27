import { assertEquals } from '@std/assert'
import * as functions from './functions.ts'
import { join } from '@std/path'
import { ensureDir } from '@std/fs'

Deno.test('Functions Module - Pipeline & Config', async () => {
  const testSlug = 'test-project-' + Date.now()
  const functionsDir = './db/functions'
  const projectDir = join(functionsDir, testSlug)
  const file1 = join(projectDir, '01-first.js')
  const file2 = join(projectDir, '02-second.js')

  try {
    await Deno.remove('./db_test/deployment_functions', { recursive: true })
    await ensureDir('./db_test/deployment_functions')
  } catch {
    // Skipped
  }

  await ensureDir(projectDir)

  // Initialize module
  await functions.init()

  // Define test row type
  type TestRow = {
    id: number
    step1?: boolean
    step2?: boolean
    var1?: string
  }

  // 1. Create function files
  const code1 = `
    export default {
        read: (row, ctx) => {
            return { ...row, step1: true, var1: 'secret-value' }
        }
    }
    `
  const code2 = `
    export default {
        read: (row) => {
            return { ...row, step2: true }
        }
    }
    `
  await Deno.writeTextFile(file1, code1)
  await Deno.writeTextFile(file2, code2)

  // Give watcher time
  await new Promise((r) => setTimeout(r, 1000))

  // 2. Verify loading and sorting
  const loaded = functions.getProjectFunctions(testSlug)
  if (!loaded) throw new Error('Functions not loaded')
  assertEquals(loaded.length, 2)
  assertEquals(loaded[0].name, '01-first.js')
  assertEquals(loaded[1].name, '02-second.js')

  // 3. Mock Deployment Config
  const deploymentUrl = 'test-pipeline-' + Date.now() + '.com'

  // 4. Simulate Pipeline Execution (Manually, echoing sql.ts logic)
  // We can't import sql.ts functions easily here without mocking runSQL,
  // so we re-implement the pipeline logic to verify the components work.

  let row: TestRow = { id: 1 }

  for (const { module } of loaded) {
    if (!module.read) continue

    const ctx = {
      deploymentUrl,
      projectId: testSlug,
    }
    row = await module.read(row, ctx) as TestRow
  }

  const result = row
  assertEquals(result.step1, true)
  assertEquals(result.var1, 'secret-value')

  // Rerun pipeline
  row = { id: 1 }

  for (const { module } of loaded) {
    if (!module.read) continue
    const ctx = {
      deploymentUrl,
      projectId: testSlug,
    }
    row = await module.read(row, ctx) as TestRow
  }

  const result2 = row
  assertEquals(result2.step1, true)
  assertEquals(result2.step2, true)

  // Cleanup
  await Deno.remove(projectDir, { recursive: true })
  try {
    await Deno.remove('./db_test/deployment_functions', { recursive: true })
  } catch {
    // Skipped
  }
  await new Promise((r) => setTimeout(r, 500))
  functions.stopWatcher()
})
