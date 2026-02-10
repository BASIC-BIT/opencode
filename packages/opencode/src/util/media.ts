export namespace Media {
  export const ImageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
  const Images = new Set<string>(ImageMimes)

  export function normalizeMime(mime: string) {
    const base = mime.toLowerCase().split(";", 1)[0]?.trim() ?? ""
    if (base === "image/jpg") return "image/jpeg"
    if (base === "image/*") return "image/jpeg"
    return base
  }

  export function isSupportedImageMime(mime: string) {
    return Images.has(normalizeMime(mime))
  }

  export function isDataUrl(url: string) {
    return url.startsWith("data:") && url.includes(",")
  }

  export function dataUrlImage(input: { mime: string; url: string }) {
    if (!isDataUrl(input.url)) return
    const mime = normalizeMime(input.mime)
    if (!isSupportedImageMime(mime)) return

    const commaIndex = input.url.indexOf(",")
    const base64 = commaIndex === -1 ? "" : input.url.slice(commaIndex + 1)
    if (!base64) return

    return {
      mime,
      url: `data:${mime};base64,${base64}`,
    }
  }
}
