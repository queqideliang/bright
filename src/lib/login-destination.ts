export function loginDestination(value?: string | null) {
  if (!value) return '/models';
  if (value === '/settings' || value === '/pricing' || value === '/reports') return value;
  if (/^\/reports\?(?:model=[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}(?:&page=[1-9]\d{0,5})?|page=[1-9]\d{0,5})$/iu.test(value)) return value;
  if (/^\/models(?:\/[\da-f-]{36})?(?:\?tool=review)?$/.test(value)) return value;
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
