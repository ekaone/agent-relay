/**
 * Example: Deterministic coordinator
 *
 * No LLM involved. You define the delegation sequence in code.
 * Great for CI/CD pipelines, release scripts, and any repeatable workflow.
 *
 * Run: npx tsx examples/deterministic.ts
 */
import { execSync } from 'node:child_process'
import { createBus, createAgent, runDeterministic } from '../src/index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sh(cmd: string): string {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim()
}

// ─── Specialist agents ────────────────────────────────────────────────────────

const npmAgent = createAgent<{ command: string }, { success: boolean; output: string }>({
  name: 'npm',
  description: 'Runs npm lifecycle commands: install, build, test, publish',
  commands: ['install', 'build', 'test', 'publish'],
  handler: async task => {
    const { command } = task.input
    switch (command) {
      case 'install': return { success: true, output: sh('npm install') }
      case 'build':   return { success: true, output: sh('npm run build') }
      case 'test':    return { success: true, output: sh('npm test') }
      case 'publish': return { success: true, output: sh('npm publish --access public --provenance') }
      default: throw new Error(`Unknown npm command: ${command}`)
    }
  },
})

const deployAgent = createAgent<{ command: string }, { success: boolean; output: string }>({
  name: 'deploy',
  description: 'Runs deployment commands: docker-build, docker-push, restart',
  commands: ['docker-build', 'docker-push', 'restart'],
  handler: async task => {
    const { command } = task.input
    switch (command) {
      case 'docker-build': return { success: true, output: sh('docker build -t myapp .') }
      case 'docker-push':  return { success: true, output: sh('docker push myapp:latest') }
      case 'restart':      return { success: true, output: sh('echo "restarting service..."') }
      default: throw new Error(`Unknown deploy command: ${command}`)
    }
  },
})

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const bus = createBus()
  bus.register(npmAgent)
  bus.register(deployAgent)

  console.log('\n🚀 Starting release pipeline...\n')

  const results = await runDeterministic(bus, [
    { to: 'npm',    input: { command: 'install' } },
    { to: 'npm',    input: { command: 'build' } },
    { to: 'npm',    input: { command: 'test' } },
    { to: 'npm',    input: { command: 'publish' } },
    { to: 'deploy', input: { command: 'docker-build' } },
    { to: 'deploy', input: { command: 'docker-push' } },
    { to: 'deploy', input: { command: 'restart' } },
  ])

  console.log('\n── Results ──────────────────────────────────────')
  for (const r of results) {
    const icon = r.status === 'done' ? '✅' : '❌'
    console.log(`${icon} [${r.to}] ${(r.input as { command: string }).command} → ${r.status}`)
    if (r.status === 'failed') console.log(`   Error: ${r.error?.message}`)
  }

  // Check dead-letter queue
  const failed = bus.deadLetter.drain()
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} task(s) in dead-letter queue`)
  }
}

main().catch(console.error)
