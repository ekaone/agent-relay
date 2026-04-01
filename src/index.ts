/**
 * @file index.ts
 * @description Core entry point for @ekaone/package_name.
 * @author Eka Prasetia
 * @website https://prasetia.me
 * @license MIT
 */

export { createBus } from "./bus.js";
export { createAgent } from "./agent.js";
export { delegate, send, receive } from "./relay.js";

// Coordinator
export { createCoordinator, runDeterministic } from "./coordinator.js";

// Dead-letter
export { createDeadLetterQueue } from "./dead-letter.js";

// Store
export { createMemoryStore } from "./store/memory.js";

// Types
export type {
  // Task
  AgentTask,
  TaskStatus,
  // Agent
  Agent,
  AgentDefinition,
  AgentHandler,
  // Bus
  BusInstance,
  BusStore,
  AgentManifestEntry,
  // Coordinator
  AIProvider,
  CoordinatorConfig,
  CoordinatorInstance,
  DelegationPlan,
  DelegationStep,
  // Dead-letter
  DeadLetterQueue,
} from "./types.js";
