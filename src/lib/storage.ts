const base = () => (import.meta.env.VITE_SUPABASE_URL as string) ?? ''

export function entryImageUrl(path: string): string {
  return `${base()}/storage/v1/object/public/entry-images/${path}`
}

export function avatarUrl(path: string): string {
  return `${base()}/storage/v1/object/public/avatars/${path}`
}
