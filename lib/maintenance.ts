export const MAINTENANCE_PATH = "/maintenance";

/** Read by the proxy, which serves the holding page for every route while this
 * is on, and by the footer, which drops its links for that reason. */
export function maintenanceOn(): boolean {
  return process.env.MAINTENANCE === "on";
}
