import UIKit

enum MotionScreenshotPixels {
  private struct PixelColor {
    let red: UInt8
    let green: UInt8
    let blue: UInt8
  }

  struct GreenRowMeasurement {
    let greenCoverage: Double
    let checkPixels: Int
  }

  static func measureGreenRow(_ image: UIImage, rowFrame: CGRect) -> GreenRowMeasurement {
    guard let cgImage = image.cgImage, let pixels = rgbaPixels(cgImage) else {
      return GreenRowMeasurement(greenCoverage: 0, checkPixels: 0)
    }
		let scale = CGFloat(cgImage.width) / rowFrame.width
    let row = pixelFrame(rowFrame, scale: scale, width: cgImage.width, height: cgImage.height)
    let center = CGPoint(x: row.midX, y: row.midY)
    var greenCount = 0
    var sampleCount = 0
    var checkPixels = 0
    for rowY in Int(row.minY)..<Int(row.maxY) {
      for columnX in Int(row.minX)..<Int(row.maxX) {
        let color = pixel(pixels, columnX: columnX, rowY: rowY, width: cgImage.width)
        if isCheckPixel(color, point: CGPoint(x: columnX, y: rowY), center: center) {
          checkPixels += 1
          continue
        }
        sampleCount += 1
        if isOrganizeGreen(color) { greenCount += 1 }
      }
    }
    return GreenRowMeasurement(
      greenCoverage: sampleCount == 0 ? 0 : Double(greenCount) / Double(sampleCount),
      checkPixels: checkPixels
    )
  }

  private static func rgbaPixels(_ image: CGImage) -> [UInt8]? {
    var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
    let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(
        data: buffer.baseAddress,
        width: image.width,
        height: image.height,
        bitsPerComponent: 8,
        bytesPerRow: image.width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
      ) else { return false }
      context.translateBy(x: 0, y: CGFloat(image.height))
      context.scaleBy(x: 1, y: -1)
      context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
      return true
    }
    return rendered ? pixels : nil
  }

  private static func pixelFrame(
    _ frame: CGRect,
    scale: CGFloat,
    width: Int,
    height: Int
  ) -> CGRect {
    let scaled = CGRect(
      x: frame.minX * scale,
		y: CGFloat(height) - frame.maxY * scale,
      width: frame.width * scale,
      height: frame.height * scale
    ).integral
    return scaled.intersection(CGRect(x: 0, y: 0, width: width, height: height))
  }

  private static func pixel(
    _ pixels: [UInt8],
    columnX: Int,
    rowY: Int,
    width: Int
  ) -> PixelColor {
    let index = (rowY * width + columnX) * 4
    return PixelColor(red: pixels[index], green: pixels[index + 1], blue: pixels[index + 2])
  }

  private static func isCheckPixel(
    _ color: PixelColor,
    point: CGPoint,
    center: CGPoint
  ) -> Bool {
    abs(point.x - center.x) <= 36 && abs(point.y - center.y) <= 36 &&
      color.red > 220 && color.green > 220 && color.blue > 220
  }

  private static func isOrganizeGreen(_ color: PixelColor) -> Bool {
    color.green > 80 && Double(color.green) > Double(color.red) * 1.12 &&
      Double(color.green) > Double(color.blue) * 0.92
  }
}
