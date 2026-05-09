const DEFAULT_ADMIN_EMAILS = ['ezvibesinc@gmail.com'];

function parseAdminEmails(configured?: string): Set<string> {
  const values = configured?.trim()
    ? configured.split(',').map((value) => value.trim().toLowerCase())
    : DEFAULT_ADMIN_EMAILS;
  return new Set(values.filter(Boolean));
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allowlist = parseAdminEmails(import.meta.env.VITE_ADMIN_EMAILS);
  return allowlist.has(email.trim().toLowerCase());
}

