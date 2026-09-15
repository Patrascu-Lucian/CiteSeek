/** Whether the operator named this host. Read the name before `.env.local` loads:
 * the file that supplied the database cannot also confirm it. An empty name
 * confirms nothing, though every hostname includes `""`. */
export function namesHost(
  confirmed: string | undefined,
  hostname: string,
): boolean {
  const name = confirmed?.trim();
  return name !== undefined && name !== "" && hostname.includes(name);
}
