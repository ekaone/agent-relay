import type { AgentTask, BusStore, TaskStatus } from '../types.js'

export function createMemoryStore(): BusStore {
  const tasks = new Map<string, AgentTask>()

  return {
    async save(task) {
      tasks.set(task.id, { ...task })
    },

    async find(id) {
      return tasks.get(id) ?? null
    },

    async list(filter) {
      let results = [...tasks.values()]

      if (filter?.status) {
        results = results.filter(t => t.status === filter.status)
      }
      if (filter?.to) {
        results = results.filter(t => t.to === filter.to)
      }

      return results
    },

    async clear() {
      tasks.clear()
    },
  }
}
