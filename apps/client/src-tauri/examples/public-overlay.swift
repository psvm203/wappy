// A reproducible renderer experiment, not the production desktop implementation.
// Only public AppKit APIs are used; no WebKit, KVC, private selectors or screen capture.
import AppKit

enum CheckFailure: Error { case failed(String) }
func check(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw CheckFailure.failed(message) }
}

@MainActor
final class OverlayWindow: NSWindow {
  override var canBecomeKey: Bool { false }
  override var canBecomeMain: Bool { false }
}

struct Resident {
  let image: NSImage
  let name: String
  let angle: CGFloat
  let facing: CGFloat
  var center: NSPoint
}

struct CharacterAsset: Decodable {
  let kind: String
  let name: String
}

@MainActor
final class OverlayView: NSView {
  var residents: [Resident]
  var clicks = 0
  private var drag: (index: Int, offset: NSPoint, start: NSPoint)?
  private var moved = false
  override var isFlipped: Bool { true }
  override var isOpaque: Bool { false }

  init(residents: [Resident], size: NSSize) {
    self.residents = residents
    super.init(frame: NSRect(origin: .zero, size: size))
  }
  required init?(coder: NSCoder) { nil }

  func resident(at point: NSPoint) -> Int? {
    residents.indices.reversed().first { index in
      let center = residents[index].center
      return NSRect(x: center.x - 42, y: center.y - 42, width: 84, height: 84).contains(point)
    }
  }
  override func hitTest(_ point: NSPoint) -> NSView? {
    resident(at: point) == nil ? nil : self
  }
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

  override func draw(_ dirtyRect: NSRect) {
    NSColor.clear.setFill()
    dirtyRect.fill(using: .copy)
    for item in residents {
      NSGraphicsContext.saveGraphicsState()
      let transform = NSAffineTransform()
      transform.translateX(by: item.center.x, yBy: item.center.y)
      transform.rotate(byRadians: item.angle)
      transform.scaleX(by: item.facing, yBy: 1)
      transform.concat()
      item.image.draw(
        in: NSRect(x: -38, y: -42, width: 76, height: 84),
        from: .zero, operation: .sourceOver, fraction: 1,
        respectFlipped: true, hints: nil)
      NSGraphicsContext.restoreGraphicsState()
      let label = NSRect(x: item.center.x - 54, y: item.center.y + 49, width: 108, height: 21)
      NSColor(calibratedWhite: 0.98, alpha: 0.91).setFill()
      NSBezierPath(roundedRect: label, xRadius: 6, yRadius: 6).fill()
      let paragraph = NSMutableParagraphStyle()
      paragraph.alignment = .center
      (item.name as NSString).draw(
        in: label.insetBy(dx: 3, dy: 3),
        withAttributes: [
          .font: NSFont.systemFont(ofSize: 11),
          .foregroundColor: NSColor(calibratedRed: 0.32, green: 0.39, blue: 0.28, alpha: 1),
          .paragraphStyle: paragraph,
        ])
    }
  }

  override func mouseDown(with event: NSEvent) {
    let point = convert(event.locationInWindow, from: nil)
    guard let index = resident(at: point) else { return }
    let center = residents[index].center
    drag = (index, NSPoint(x: point.x - center.x, y: point.y - center.y), point)
    moved = false
  }
  override func mouseDragged(with event: NSEvent) {
    guard let drag else { return }
    let point = convert(event.locationInWindow, from: nil)
    moved = moved || hypot(point.x - drag.start.x, point.y - drag.start.y) >= 6
    residents[drag.index].center = NSPoint(
      x: min(bounds.width - 60, max(60, point.x - drag.offset.x)),
      y: min(bounds.height - 75, max(50, point.y - drag.offset.y)))
    needsDisplay = true
  }
  override func mouseUp(with event: NSEvent) {
    guard drag != nil else { return }
    mouseDragged(with: event)
    if !moved { clicks += 1 }
    drag = nil
  }
}

@MainActor
func runCheck(directory: URL) throws {
  let app = NSApplication.shared
  app.setActivationPolicy(.accessory)
  let characters = try JSONDecoder().decode(
    [CharacterAsset].self,
    from: Data(contentsOf: directory.appendingPathComponent("characters.json")))
  try check(!characters.isEmpty, "No character assets were generated")
  let columns = min(7, characters.count)
  let rows = (characters.count * 2 + columns - 1) / columns
  var residents: [Resident] = []
  for (stateIndex, state) in ["awake", "asleep"].enumerated() {
    for (index, character) in characters.enumerated() {
      let position = stateIndex * characters.count + index
      let column = position % columns
      let row = position / columns
      let url = directory.appendingPathComponent("\(character.kind)-\(state).svg")
      guard let image = NSImage(contentsOf: url) else {
        throw CheckFailure.failed("AppKit could not decode \(url.lastPathComponent)")
      }
      residents.append(
        Resident(
          image: image, name: "\(character.name) · \(stateIndex == 0 ? "접속 중" : "쉬는 중")",
          angle: CGFloat(column) * .pi / 2, facing: column.isMultiple(of: 2) ? 1 : -1,
          center: NSPoint(x: 85 + column * 140, y: 75 + row * 165)))
    }
  }
  let view = OverlayView(
    residents: residents, size: NSSize(width: columns * 140 + 40, height: rows * 165 + 10))
  let window = OverlayWindow(
    contentRect: view.bounds, styleMask: .borderless, backing: .buffered, defer: false)
  // NSWindow/NSView transparency is public; WKWebView transparency is the current blocker.
  window.isReleasedWhenClosed = false
  window.isOpaque = false
  window.backgroundColor = .clear
  window.hasShadow = false
  window.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 1)
  window.ignoresMouseEvents = true
  window.contentView = view
  window.center()
  window.orderFrontRegardless()
  defer {
    window.orderOut(nil)
    window.close()
  }
  RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.15))
  try check(
    window.isVisible && !window.isKeyWindow && !window.isMainWindow,
    "Overlay changed keyboard focus")
  try check(
    !window.isOpaque && window.backgroundColor.alphaComponent == 0, "Window is not transparent")
  try check(view.hitTest(NSPoint(x: 10, y: 10)) == nil, "Empty space intercepted input")
  try check(view.hitTest(residents[0].center) === view, "Character hit testing failed")
  try check(view.acceptsFirstMouse(for: nil), "An inactive overlay must accept the first click")

  // Dispatch through this NSWindow; never inject input into another app.
  func mouse(_ type: NSEvent.EventType, at point: NSPoint) throws -> NSEvent {
    guard
      let event = NSEvent.mouseEvent(
        with: type, location: view.convert(point, to: nil),
        modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
        windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)
    else { throw CheckFailure.failed("Could not create a local mouse event") }
    return event
  }
  window.ignoresMouseEvents = false
  let original = view.residents[0].center
  window.sendEvent(try mouse(.leftMouseDown, at: original))
  window.sendEvent(try mouse(.leftMouseUp, at: original))
  try check(view.clicks == 1, "Click was not delivered")
  let moved = NSPoint(x: original.x + 20, y: original.y + 10)
  window.sendEvent(try mouse(.leftMouseDown, at: original))
  window.sendEvent(try mouse(.leftMouseDragged, at: moved))
  window.sendEvent(try mouse(.leftMouseUp, at: moved))
  try check(
    view.residents[0].center == moved && view.clicks == 1, "Dragging should move without clicking")
  view.residents[0].center = original
  window.sendEvent(try mouse(.leftMouseDown, at: NSPoint(x: 10, y: 10)))
  window.sendEvent(try mouse(.leftMouseUp, at: NSPoint(x: 10, y: 10)))
  try check(view.clicks == 1 && !window.isKeyWindow, "Empty-space clicks or dragging changed focus")
  // The app can switch native click-through using its existing cursor/hit-test policy.
  window.ignoresMouseEvents = false
  try check(!window.ignoresMouseEvents, "Could not enable native input")
  window.ignoresMouseEvents = true
  try check(window.ignoresMouseEvents, "Could not restore click-through")

  guard let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
    throw CheckFailure.failed("Could not allocate the native view bitmap")
  }
  view.cacheDisplay(in: view.bounds, to: bitmap)
  try check(bitmap.hasAlpha, "Native rendering lost its alpha channel")
  let scaleX = CGFloat(bitmap.pixelsWide) / view.bounds.width
  let scaleY = CGFloat(bitmap.pixelsHigh) / view.bounds.height
  func alpha(at point: NSPoint) -> CGFloat {
    bitmap.colorAt(x: Int(point.x * scaleX), y: Int(point.y * scaleY))?.alphaComponent ?? -1
  }
  for point in [NSPoint(x: 1, y: 1), NSPoint(x: 10, y: 150), NSPoint(x: view.bounds.maxX - 5, y: view.bounds.maxY - 5)] {
    try check(alpha(at: point) == 0, "Transparent space was painted opaque")
  }
  for item in residents { try check(alpha(at: item.center) > 0.9, "A character did not render") }
  let imageURL = directory.appendingPathComponent("public-overlay.png")
  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    throw CheckFailure.failed("Could not encode the preview")
  }
  try png.write(to: imageURL)
  let result: [String: Any] = [
    "passed": true, "os": ProcessInfo.processInfo.operatingSystemVersionString,
    "characters": residents.count, "bitmapWidth": bitmap.pixelsWide,
    "bitmapHeight": bitmap.pixelsHigh,
    "transparentBackground": true, "preservesKeyboardFocus": true,
    "localClickAndDrag": true, "clickThroughToggle": true,
    "productionRendererChanged": false,
  ]
  let data = try JSONSerialization.data(
    withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
  try data.write(to: directory.appendingPathComponent("result.json"))
  print(String(decoding: data, as: UTF8.self))
}

@main
struct PublicOverlayCheck {
  @MainActor static func main() {
    do {
      guard CommandLine.arguments.count == 2 else {
        throw CheckFailure.failed("Expected the generated asset directory")
      }
      try runCheck(directory: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
    } catch {
      fputs("Public overlay check failed: \(error)\n", stderr)
      exit(1)
    }
  }
}
