import AppKit
import Foundation
import PDFKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let pdfDirectory = root.appendingPathComponent("output/pdf")
let outputDirectory = root.appendingPathComponent("output/pdf-rendered")
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let files = try FileManager.default.contentsOfDirectory(at: pdfDirectory, includingPropertiesForKeys: nil)
  .filter { $0.pathExtension.lowercased() == "pdf" }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

for file in files {
  guard let document = PDFDocument(url: file), document.pageCount > 0 else {
    throw NSError(domain: "UserGuidePDF", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not open \(file.lastPathComponent)"])
  }

  print("\(file.lastPathComponent): \(document.pageCount) pages")
  let sampleIndexes = Set([0, document.pageCount / 2, document.pageCount - 1]).sorted()
  for index in sampleIndexes {
    guard let page = document.page(at: index) else { continue }
    let image = page.thumbnail(of: NSSize(width: 1240, height: 1754), for: .mediaBox)
    guard let tiff = image.tiffRepresentation,
          let representation = NSBitmapImageRep(data: tiff),
          let png = representation.representation(using: .png, properties: [:]) else {
      throw NSError(domain: "UserGuidePDF", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not render page \(index + 1) of \(file.lastPathComponent)"])
    }
    let baseName = file.deletingPathExtension().lastPathComponent
    let target = outputDirectory.appendingPathComponent("\(baseName)-page-\(index + 1).png")
    try png.write(to: target)
  }
}
