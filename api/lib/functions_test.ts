import { assertEquals } from '@std/assert'
import * as functions from './functions.ts'
import { join } from '@std/path'
import { ensureDir } from '@std/fs'
import { DeploymentFunctionsCollection } from '../schema.ts'

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
            return { ...row, step1: true, var1: ctx.variables.var1 }
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

  // Config for 01-first.js (Enabled with variables)
  await DeploymentFunctionsCollection.insert({
    id: deploymentUrl + ':01-first.js',
    deploymentUrl,
    functionName: '01-first.js',
    enabled: true,
    variables: { var1: 'secret-value' },
  })

  // Config for 02-second.js (Disabled)
  await DeploymentFunctionsCollection.insert({
    id: deploymentUrl + ':02-second.js',
    deploymentUrl,
    functionName: '02-second.js',
    enabled: false,
    variables: {},
  })

  // 4. Simulate Pipeline Execution (Manually, echoing sql.ts logic)
  // We can't import sql.ts functions easily here without mocking runSQL,
  // so we re-implement the pipeline logic to verify the components work.

  let row: TestRow = { id: 1 }
  const configs = DeploymentFunctionsCollection.filter((c) =>
    c.deploymentUrl === deploymentUrl && c.enabled
  )
  const configMap = new Map(configs.map((c) => [c.functionName, c]))

  for (const { name, module } of loaded) {
    const config = configMap.get(name)
    if (!config || !module.read) continue

    const ctx = {
      deploymentUrl,
      projectId: testSlug,
      variables: config.variables || undefined,
    }
    row = await module.read(row, ctx) as TestRow
  }

  const result = row
  assertEquals(result.step1, true)
  assertEquals(result.var1, 'secret-value')
  assertEquals(result.step2, undefined) // Should be skipped

  // 5. Enable second function
  await DeploymentFunctionsCollection.update(deploymentUrl + ':02-second.js', {
    enabled: true,
  })

  // Rerun pipeline
  row = { id: 1 }
  const configs2 = DeploymentFunctionsCollection.filter((c) =>
    c.deploymentUrl === deploymentUrl && c.enabled
  )
  const configMap2 = new Map(configs2.map((c) => [c.functionName, c]))

  for (const { name, module } of loaded) {
    const config = configMap2.get(name)
    if (!config || !module.read) continue
    const ctx = {
      deploymentUrl,
      projectId: testSlug,
      variables: config.variables || undefined,
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
