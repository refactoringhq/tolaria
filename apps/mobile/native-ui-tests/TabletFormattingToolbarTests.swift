import XCTest

final class TabletFormattingToolbarTests: XCTestCase {
  func testFormattingMenusKeepTouchTargetsAndApplyHeading() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&editorMode=wysiwyg&tabletPanels=all&qaRun=toolbar"]
    app.launch()
    let headings = element(app, "editor-format-menu-headings")
    XCTAssertTrue(headings.waitForExistence(timeout: 60))
    XCTAssertEqual(headings.frame.width, 44, accuracy: 1)
    XCTAssertEqual(headings.frame.height, 44, accuracy: 1)
    headings.tap()
    let heading = element(app, "editor-format-heading-2")
    XCTAssertTrue(heading.waitForExistence(timeout: 5))
    XCTAssertTrue(heading.isHittable)
    XCTAssertGreaterThanOrEqual(heading.frame.height, 44)
    XCTAssertTrue(app.frame.contains(heading.frame))
    heading.tap()
    waitUntil { !heading.exists }
    headings.tap()
    waitUntil { heading.exists && heading.isSelected }
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.lifetime = .keepAlways
    add(screenshot)
    // The overlay must dismiss without moving a panel or consuming the next tap.
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
    waitUntil { !heading.exists }
    let lists = element(app, "editor-format-menu-lists")
    lists.tap()
    XCTAssertTrue(element(app, "editor-format-bullet-list").waitForExistence(timeout: 5))
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15)).tap()
    let toggle = app.buttons.matching(identifier: "editor-properties-action").firstMatch
    toggle.tap()
    waitUntil { !self.element(app, "properties-panel").exists }
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  private func waitUntil(_ predicate: @escaping () -> Bool) {
    expectation(for: NSPredicate { _, _ in predicate() }, evaluatedWith: nil)
    waitForExpectations(timeout: 10)
  }
}
