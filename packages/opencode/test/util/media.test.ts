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
    expect(Media.isSupportedImageMime("image/bmp")).toBe(false)
  })

  test("dataUrlImage omits invalid image bytes", () => {
    const result = Media.dataUrlImage({
      mime: "image/png",
      url: "data:image/png;base64,aGVsbG8=",
    })
    expect(result).toBeUndefined()
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

  test("dataUrlImage extracts embedded PNGs from ICO", () => {
    const png = Buffer.from(PNG_BASE64, "base64")
    const ico = (() => {
      const header = Buffer.alloc(22)
      header.writeUInt16LE(0, 0)
      header.writeUInt16LE(1, 2)
      header.writeUInt16LE(1, 4)
      header[6] = 1
      header[7] = 1
      header[8] = 0
      header[9] = 0
      header.writeUInt16LE(1, 10)
      header.writeUInt16LE(32, 12)
      header.writeUInt32LE(png.length, 14)
      header.writeUInt32LE(22, 18)
      return Buffer.concat([header, png])
    })()

    const result = Media.dataUrlImage({
      mime: "image/x-icon",
      url: `data:image/x-icon;base64,${ico.toString("base64")}`,
    })
    expect(result).toEqual({
      mime: "image/png",
      url: `data:image/png;base64,${PNG_BASE64}`,
    })
  })

  test("dataUrlImage sniffs supported types from incorrect mimes", () => {
    const result = Media.dataUrlImage({
      mime: "image/apng",
      url: `data:image/apng;base64,${PNG_BASE64}`,
    })
    expect(result).toEqual({
      mime: "image/png",
      url: `data:image/png;base64,${PNG_BASE64}`,
    })
  })
})
