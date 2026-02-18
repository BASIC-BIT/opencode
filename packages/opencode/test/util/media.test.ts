import { describe, expect, test } from "bun:test"
import { Media } from "../../src/util/media"

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

describe("util.media", () => {
  test("normalizeMime", () => {
    expect(Media.normalizeMime("image/jpg")).toBe("image/jpeg")
    expect(Media.normalizeMime("IMAGE/JPG; charset=utf-8")).toBe("image/jpeg")
    expect(Media.normalizeMime("image/png;foo=bar")).toBe("image/png")
  })

  test("isSupportedImageMime", () => {
    expect(Media.isSupportedImageMime("image/jpg")).toBe(true)
    expect(Media.isSupportedImageMime("image/gif")).toBe(false)
    expect(Media.isSupportedImageMime("image/webp")).toBe(false)
    expect(Media.isSupportedImageMime("image/bmp")).toBe(false)
  })

  test("isImageMime", () => {
    expect(Media.isImageMime("image/png")).toBe(true)
    expect(Media.isImageMime("IMAGE/JPG")).toBe(true)
    expect(Media.isImageMime("image/*")).toBe(true)
    expect(Media.isImageMime("application/pdf")).toBe(false)
  })

  test("imageMime", () => {
    expect(Media.imageMime("image/jpg")).toBe("image/jpeg")
    expect(Media.imageMime("image/bmp")).toBeUndefined()
  })

  test("isDataUrl", () => {
    expect(Media.isDataUrl("data:image/png;base64,AAAA")).toBe(true)
    expect(Media.isDataUrl("https://example.com")).toBe(false)
  })

  test("dataUrlImage omits unsupported image mimes", () => {
    const result = Media.dataUrlImage({
      mime: "image/x-icon",
      url: "data:image/x-icon;base64,AAAA",
    })
    expect(result).toBeUndefined()
  })

  test("dataUrlImage normalizes image/jpg to image/jpeg", () => {
    const result = Media.dataUrlImage({
      mime: "image/jpg",
      url: "data:image/jpg;base64,AAAA",
    })
    expect(result).toEqual({
      mime: "image/jpeg",
      url: "data:image/jpeg;base64,AAAA",
    })
  })

  test("dataUrlImage passes through supported images", () => {
    const result = Media.dataUrlImage({
      mime: "image/png",
      url: `data:image/png;base64,${PNG_BASE64}`,
    })
    expect(result).toEqual({
      mime: "image/png",
      url: `data:image/png;base64,${PNG_BASE64}`,
    })
  })
})
