import { describe, it, expect } from 'vitest'
import { createDeadLetterQueue } from '../src/dead-letter.js'
import { createBus } from '../src/bus.js'
import { createAgent } from '../src/agent.js'

function makeFailedTask(id = '1') {
  return {
    id,
    from: 'coordinator',
    to: 'agent',
    input: null,
    status: 'failed' as const,
    error: new Error('oops'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('createDeadLetterQueue', () => {
  it('push and drain tasks', () => {
    const dlq = createDeadLetterQueue()
    dlq.push(makeFailedTask('1'))
    dlq.push(makeFailedTask('2'))

    const drained = dlq.drain()
    expect(drained).toHaveLength(2)
    expect(dlq.drain()).toHaveLength(0)
  })

  it('retry re-dispatches a task successfully', async () => {
    const bus = createBus()
    let callCount = 0

    bus.register(createAgent({
      name: 'agent',
      description: 'Retryable agent',
      handler: async () => { callCount++; return 'ok' },
    }))

    const task = makeFailedTask('x')
    bus.deadLetter.push(task)

    const result = await bus.deadLetter.retry('x', bus)
    expect(result.status).toBe('done')
    expect(callCount).toBe(1)
  })

  it('retry throws when task id not found', async () => {
    const bus = createBus()
    await expect(bus.deadLetter.retry('nonexistent', bus)).rejects.toThrow('not found')
  })
})
