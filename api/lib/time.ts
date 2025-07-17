// Shared functions to manage time

export const startTime = performance.timeOrigin / 1000
/**
 * Return the current timestamp in seconds since the epoch.
 * Uses the performance API for high precision timing.
 * Ensured to be unique per process.
 *
 * @example
 * const timestamp = now();
 * console.log(timestamp); // Output: 1731521396.557123 (example timestamp)
 */
let lastTime = startTime
export const now = (): number => {
  const time = startTime + performance.now() / 1000
  if (time === lastTime) return now()
  lastTime = time
  return time
}

export const SEC = 1
export const MIN = 60
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY
export const YEAR = 365.2422 * DAY
