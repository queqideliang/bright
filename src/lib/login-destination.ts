export function loginDestination(value?: string | null) {
  if (!value) return '/models';
  if (value === '/settings' || value === '/pricing') return value;
  if (/^\/models(?:\/[\da-f-]{36})?$/.test(value)) return value;
  if (!/^\/workbench(?:\?[^#\\]+)?$/.test(value)) return '/models';
  const query = new URL(value, 'https://workbench.invalid').searchParams;
  const seen = new Set<string>();
  for (const [key, item] of query) {
    if (seen.has(key)) return '/models';
    seen.add(key);
    if (key === 'demo' && item === '1') continue;
    if (key === 'tool' && ['documents','quantity','review','export'].includes(item)) continue;
    if (key === 'share' && /^[\da-f-]{36}\.[\w-]{24}$/.test(item)) continue;
    return '/models';
  }
  return value;
}
