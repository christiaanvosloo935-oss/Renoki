// Client-side image processing helpers.
// - Strips EXIF (canvas re-encode does this automatically)
// - Resizes to a max dimension
// - Encodes as WebP with a given quality
// - Supabase image transforms are paid, so we do this in the browser.

export interface ResizeOptions {
  maxDim: number       // longest edge, in pixels
  quality?: number     // 0..1, defaults to 0.85
  mime?: 'image/webp' | 'image/jpeg'
}

export async function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not read image'))
      img.src = url
    })
    return img
  } finally {
    // revoke later, once caller has drawn it
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export async function resizeImage(file: File | Blob, opts: ResizeOptions): Promise<Blob> {
  const { maxDim, quality = 0.85, mime = 'image/webp' } = opts
  const img = await loadImage(file)
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('WebP encoding failed'))),
      mime,
      quality
    )
  })
}
