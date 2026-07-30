import AppKit
import Foundation

// This script flattens the transparent Icon Composer foreground over white for the legacy ICNS pipeline.
guard CommandLine.arguments.count == 3 else {
  fputs("Usage: render_macos_legacy_icon.swift <foreground-path> <output-path>\n", stderr)
  exit(1)
}

let foregroundPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
let iconSize = 1024

guard let foregroundImage = NSImage(contentsOfFile: foregroundPath) else {
  fputs("Failed to read icon foreground at \(foregroundPath)\n", stderr)
  exit(1)
}

// Draw the white background and foreground into one lossless image that iconutil can resize.
guard
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: iconSize,
    pixelsHigh: iconSize,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ),
  let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap)
else {
  fputs("Failed to create the macOS icon canvas.\n", stderr)
  exit(1)
}

let iconRect = NSRect(x: 0, y: 0, width: iconSize, height: iconSize)

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphicsContext
NSColor.white.setFill()
iconRect.fill()
foregroundImage.draw(in: iconRect, from: .zero, operation: .sourceOver, fraction: 1)
graphicsContext.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

// Encode the flattened image without adding another checked-in icon asset.
guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Failed to encode the macOS icon as PNG.\n", stderr)
  exit(1)
}

do {
  try pngData.write(to: URL(fileURLWithPath: outputPath))
} catch {
  fputs("Failed to write the macOS icon to \(outputPath): \(error)\n", stderr)
  exit(1)
}
