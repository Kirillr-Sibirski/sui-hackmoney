export const ADMIN_ADDRESS =
  "0xd71d29e2ecdc72e4a53fcfe346520e1e551fafffab16b2b98b4d97adbceb8158";

export function isAdmin(address: string | undefined): boolean {
  if (!address) return false;
  return address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
}
