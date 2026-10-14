import { cpus, freemem, hostname, totalmem, uptime } from 'node:os';
import { runtimeSchema } from '@automation/contracts';

// Only aggregate health data: never enumerate files, processes or browser state.
export function runtimeSnapshot() {
  const total = totalmem();
  return runtimeSchema.parse({
    hostname: hostname(),
    uptimeSeconds: Math.floor(uptime()),
    agentUptimeSeconds: Math.floor(process.uptime()),
    memoryTotalBytes: total,
    memoryFreeBytes: Math.min(total, freemem()),
    cpuCount: Math.max(1, cpus().length),
  });
}
