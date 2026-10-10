import XCTest

final class TabletPanelGestureTests: XCTestCase {
  func testRealContinuousPanelDrag() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&editorMode=wysiwyg&tabletPanels=all&qaRun=xctest"]
    app.launch()
    let list = app.descendants(matching: .any).matching(identifier: "note-list-panel").firstMatch
    XCTAssertTrue(list.waitForExistence(timeout: 60))
    XCTAssertTrue(list.isHittable)
    let editor = app.descendants(matching: .any).matching(identifier: "editor-panel").firstMatch
    XCTAssertGreaterThan(editor.frame.minX, 400)
    let toggle = app.buttons.matching(identifier: "editor-properties-action").firstMatch
    toggle.tap()
    let properties = app.descendants(matching: .any).matching(identifier: "properties-panel").firstMatch
    waitUntil { !properties.exists }
    let start = list.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.25))
    let end = start.withOffset(CGVector(dx: -500, dy: 0))
    start.press(forDuration: 0.05, thenDragTo: end, withVelocity: XCUIGestureVelocity(rawValue: 350), thenHoldForDuration: 0)
    waitUntil { !list.exists }
    XCTAssertEqual(editor.frame.minX, 0, accuracy: 1)
    drag(editor, fromX: 0.1, dx: 270)
    waitUntil { list.exists }
    XCTAssertEqual(editor.frame.minX, 340, accuracy: 1)
    drag(list, fromX: 0.3, dx: 240)
    waitUntil { app.descendants(matching: .any).matching(identifier: "workspace-sidebar-panel").firstMatch.exists }
    XCTAssertEqual(editor.frame.minX, 600, accuracy: 1)
    let right = app.coordinate(withNormalizedOffset: CGVector(dx: 1, dy: 0.5)).withOffset(CGVector(dx: -8, dy: 0))
    right.press(forDuration: 0.05, thenDragTo: right.withOffset(CGVector(dx: -240, dy: 0)), withVelocity: XCUIGestureVelocity(rawValue: 350), thenHoldForDuration: 0)
    waitUntil { properties.exists }
    XCTAssertEqual(properties.frame.width, 300, accuracy: 1)
    drag(properties, fromX: 0.1, dx: 240)
    waitUntil { !properties.exists }
    toggle.tap()
    waitUntil { properties.exists }
    toggle.tap()
    waitUntil { !properties.exists }
    list.swipeUp(velocity: XCUIGestureVelocity(rawValue: 250))
    XCTAssertEqual(editor.frame.minX, 600, accuracy: 1)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

  private func waitUntil(_ predicate: @escaping () -> Bool) {
    expectation(for: NSPredicate { _, _ in predicate() }, evaluatedWith: nil)
    waitForExpectations(timeout: 10)
  }

  private func drag(_ element: XCUIElement, fromX: Double, dx: Double) {
    let start = element.coordinate(withNormalizedOffset: CGVector(dx: fromX, dy: 0.5))
    start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: dx, dy: 0)), withVelocity: XCUIGestureVelocity(rawValue: 250), thenHoldForDuration: 0)
  }
}
