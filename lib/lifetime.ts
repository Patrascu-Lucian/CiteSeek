const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNITS = [
  { size: 365 * DAY, one: "a year", many: "years" },
  { size: DAY, one: "a day", many: "days" },
  { size: HOUR, one: "an hour", many: "hours" },
  { size: MINUTE, one: "a minute", many: "minutes" },
] as const;

/** In the largest unit that divides it exactly, so a page never quotes a
 * rounded lifetime: 36 hours stays "36 hours", not "1.5 days". */
export function formatLifetime(seconds: number): string {
  for (const { size, one, many } of UNITS) {
    const count = seconds / size;
    if (Number.isInteger(count)) return count === 1 ? one : `${count} ${many}`;
  }

  return `${seconds} seconds`;
}
