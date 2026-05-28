import Foundation
import Vision
import AppKit

if CommandLine.arguments.count < 2 {
  fputs("Usage: swift scripts/ocr-image.swift <image>\n", stderr)
  exit(1)
}

let imagePath = CommandLine.arguments[1]
let url = URL(fileURLWithPath: imagePath)
guard let image = NSImage(contentsOf: url),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fputs("Cannot load image: \(imagePath)\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest { request, error in
  if let error = error {
    fputs("OCR error: \(error)\n", stderr)
    exit(1)
  }

  let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
  let width = Double(cgImage.width)
  let height = Double(cgImage.height)
  for observation in observations {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let box = observation.boundingBox
    let candidates = observation.topCandidates(5).map { $0.string }
    let record: [String: Any] = [
      "text": candidate.string,
      "candidates": candidates,
      "confidence": candidate.confidence,
      "x": box.minX * width,
      "y": (1.0 - box.maxY) * height,
      "w": box.width * width,
      "h": box.height * height
    ]

    if let data = try? JSONSerialization.data(withJSONObject: record, options: []),
       let line = String(data: data, encoding: .utf8) {
      print(line)
    }
  }
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["zh-Hans", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])
