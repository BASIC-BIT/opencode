export namespace Media {
  export const ImageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
  type ImageMime = (typeof ImageMimes)[number]

  const Images = new Set<string>(ImageMimes)

  export function normalizeMime(mime: string) {
    const base = mime.toLowerCase().split(";", 1)[0]?.trim() ?? ""
    if (base === "image/jpg") return "image/jpeg"
    return base
  }

  export function isSupportedImageMime(mime: string) {
    return Images.has(normalizeMime(mime))
  }

  export function dataUrlImage(input: { mime: string; url: string }) {
    if (!input.url.startsWith("data:")) return
    const commaIndex = input.url.indexOf(",")
    if (commaIndex === -1) return

    const urlMime = dataUrlMime(input.url, commaIndex)
    const base64 = input.url.slice(commaIndex + 1)
    if (!base64) return

    const mimes = [urlMime, input.mime]
      .flatMap((mime) => (mime ? [normalizeMime(mime)] : []))
      .filter((mime, index, array) => array.indexOf(mime) === index)

    const icons = new Set(["image/x-icon", "image/vnd.microsoft.icon"])
    if (mimes.some((mime) => icons.has(mime))) {
      if (looksLikeIco(base64)) {
        const png = extractPngFromIco(Buffer.from(base64, "base64"))
        if (png) {
          const data = Buffer.from(png).toString("base64")
          return {
            mime: "image/png" as ImageMime,
            url: `data:image/png;base64,${data}`,
          }
        }
      }
    }

    for (const mime of mimes) {
      if (!Images.has(mime)) continue
      if (!validateImage(mime as ImageMime, base64)) continue
      return {
        mime: mime as ImageMime,
        url: `data:${mime};base64,${base64}`,
      }
    }

    const sniffed = sniffImage(base64)
    if (!sniffed) return

    return {
      mime: sniffed,
      url: `data:${sniffed};base64,${base64}`,
    }
  }

  function dataUrlMime(url: string, commaIndex: number) {
    const header = url.slice(5, commaIndex)
    const mime = header.split(";", 1)[0]?.trim() ?? ""
    if (mime === "") return
    return mime
  }

  function decodeHead(base64: string, bytes: number) {
    const chars = Math.ceil(bytes / 3) * 4
    return Buffer.from(base64.slice(0, chars), "base64")
  }

  function looksLikeIco(base64: string) {
    const head = decodeHead(base64, 6)
    if (head.length < 6) return false
    if (head[0] !== 0x00 || head[1] !== 0x00) return false
    if (head[2] !== 0x01 || head[3] !== 0x00) return false
    return head[4] !== 0x00 || head[5] !== 0x00
  }

  function validateImage(mime: ImageMime, base64: string) {
    if (!base64) return false

    if (mime === "image/png") {
      const head = decodeHead(base64, 8)
      return (
        head.length >= 8 &&
        head[0] === 0x89 &&
        head[1] === 0x50 &&
        head[2] === 0x4e &&
        head[3] === 0x47 &&
        head[4] === 0x0d &&
        head[5] === 0x0a &&
        head[6] === 0x1a &&
        head[7] === 0x0a
      )
    }

    if (mime === "image/jpeg") {
      const head = decodeHead(base64, 3)
      return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    }

    if (mime === "image/gif") {
      const head = decodeHead(base64, 6)
      if (head.length < 6) return false
      if (head[0] !== 0x47 || head[1] !== 0x49 || head[2] !== 0x46 || head[3] !== 0x38) return false
      return (head[4] === 0x37 || head[4] === 0x39) && head[5] === 0x61
    }

    if (mime === "image/webp") {
      const head = decodeHead(base64, 12)
      return (
        head.length >= 12 &&
        head[0] === 0x52 &&
        head[1] === 0x49 &&
        head[2] === 0x46 &&
        head[3] === 0x46 &&
        head[8] === 0x57 &&
        head[9] === 0x45 &&
        head[10] === 0x42 &&
        head[11] === 0x50
      )
    }

    return false
  }

  function sniffImage(base64: string): ImageMime | undefined {
    for (const mime of ["image/png", "image/jpeg", "image/gif", "image/webp"] as const) {
      if (validateImage(mime, base64)) return mime
    }
  }

  function u16le(data: Uint8Array, offset: number) {
    return data[offset] | (data[offset + 1] << 8)
  }

  function u32le(data: Uint8Array, offset: number) {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0
  }

  function extractPngFromIco(data: Uint8Array) {
    if (data.length < 6) return
    if (u16le(data, 0) !== 0) return
    if (u16le(data, 2) !== 1) return
    const count = u16le(data, 4)
    if (count === 0) return

    const max = Math.floor((data.length - 6) / 16)
    if (count > max) return

    let best: Uint8Array | undefined
    let bestArea = 0
    for (let i = 0; i < count; i++) {
      const base = 6 + i * 16
      const width = data[base + 0] === 0 ? 256 : data[base + 0]
      const height = data[base + 1] === 0 ? 256 : data[base + 1]
      const size = u32le(data, base + 8)
      const offset = u32le(data, base + 12)
      if (offset + size > data.length) continue
      const slice = data.subarray(offset, offset + size)

      if (
        slice.length < 8 ||
        slice[0] !== 0x89 ||
        slice[1] !== 0x50 ||
        slice[2] !== 0x4e ||
        slice[3] !== 0x47 ||
        slice[4] !== 0x0d ||
        slice[5] !== 0x0a ||
        slice[6] !== 0x1a ||
        slice[7] !== 0x0a
      )
        continue

      const area = width * height
      if (area <= bestArea) continue
      best = slice
      bestArea = area
    }

    return best
  }
}
