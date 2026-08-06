/**
 * Who has used this deployment — guests and signed-in readers, not just the demo.
 *
 * `USAGE_HOST` is required for a remote database, on the same reasoning as
 * `SEED_HOST`: Neon branches are copy-on-write clones with identical row ids, so
 * the hostname is the only field that distinguishes them, and a report saying
 * "nobody has used it" against the wrong branch would be quietly wrong.
 *
 * Guests are only ever stored as `HMAC-SHA256(ip, AUTH_SECRET)`, so a hash is all
 * this can show for them — and it counts **addresses, not people**.
 */
import postgres from "postgres";

import { loadLocalEnv } from "../lib/env/load-local-env.ts";

loadLocalEnv();

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);
const hostname = (() => {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return null;
  }
})();

if (hostname && !LOCAL.has(hostname)) {
  const confirmed = process.env.USAGE_HOST;
  if (!confirmed || !hostname.includes(confirmed)) {
    throw new Error(
      `Refusing to read ${hostname} without naming it. Name it:\n\n` +
        `  USAGE_HOST=${hostname.split(".")[0]}\n`,
    );
  }
}

const sql = postgres(connectionString, { max: 1 });

function table(rows: Record<string, string | number>[]) {
  if (!rows.length) return "  (none)";
  const keys = Object.keys(rows[0]!);
  const width = Object.fromEntries(
    keys.map((k) => [
      k,
      Math.max(k.length, ...rows.map((r) => String(r[k]).length)),
    ]),
  );
  const line = (cells: (string | number)[]) =>
    "  " + cells.map((c, i) => String(c).padEnd(width[keys[i]!]!)).join("  ");
  return [line(keys), line(keys.map((k) => "-".repeat(width[k]!)))]
    .concat(rows.map((r) => line(keys.map((k) => r[k]!))))
    .join("\n");
}

try {
  console.log(`Reading ${hostname ?? "an unparseable DATABASE_URL"}\n`);

  const [totals] = await sql<
    {
      guests: number;
      guest_requests: number;
      users: number;
      user_requests: number;
    }[]
  >`
    select
      count(distinct ip_hash) filter (where actor_type = 'guest')::int as guests,
      count(*) filter (where actor_type = 'guest')::int as guest_requests,
      count(distinct actor_id) filter (where actor_type = 'user')::int as users,
      count(*) filter (where actor_type = 'user')::int as user_requests
    from usage_events
  `;

  console.log("TOTALS");
  console.log(`  guest addresses  ${totals?.guests ?? 0}`);
  console.log(`  guest requests   ${totals?.guest_requests ?? 0}`);
  console.log(`  signed-in users  ${totals?.users ?? 0}`);
  console.log(`  signed-in reqs   ${totals?.user_requests ?? 0}`);

  const people = await sql<
    {
      who: string;
      requests: number;
      tokens: number;
      first_seen: string;
      last_seen: string;
    }[]
  >`
    select
      case when u.id is null then '(deleted account)'
           else coalesce(u.email, u.name, e.actor_id) end as who,
      count(*)::int as requests,
      coalesce(sum(e.input_tokens + e.output_tokens), 0)::int as tokens,
      to_char(min(e.created_at), 'YYYY-MM-DD') as first_seen,
      to_char(max(e.created_at), 'YYYY-MM-DD') as last_seen
    from usage_events e
    left join users u on u.id::text = e.actor_id
    where e.actor_type = 'user'
    group by 1
    order by requests desc
  `;

  console.log("\nSIGNED-IN");
  console.log(table(people));

  const byDay = await sql<
    { day: string; guests: number; users: number; requests: number }[]
  >`
    select
      to_char(created_at, 'YYYY-MM-DD') as day,
      count(distinct ip_hash) filter (where actor_type = 'guest')::int as guests,
      count(distinct actor_id) filter (where actor_type = 'user')::int as users,
      count(*)::int as requests
    from usage_events
    group by 1
    order by 1 desc
    limit 14
  `;

  console.log("\nBY DAY");
  console.log(table(byDay));
} finally {
  await sql.end();
}
