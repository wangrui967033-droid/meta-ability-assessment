// Archived screen tests only. Never import from the V1.6 application entry.
const modules = import.meta.glob('../assets/rendered-v1.5/*.png', {eager: true, import: 'default', query: '?url'}) as Record<string, string>
export function questionAssetUrl(id: string | null | undefined) { return Object.entries(modules).find(([path]) => path.endsWith('/' + id + '.png'))?.[1] ?? null }
