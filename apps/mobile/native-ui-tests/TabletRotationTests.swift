import XCTest

final class TabletRotationTests: XCTestCase {
  func testRotationKeepsSelectedNoteAndReadableEditor() throws {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .landscapeLeft
    defer { XCUIDevice.shared.orientation = .landscapeLeft }
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&editorMode=wysiwyg&qaRun=rotation"]
    app.launch()
    let note = app.descendants(matching: .any).matching(identifier: "note-row-open-source-project").firstMatch
    XCTAssertTrue(note.waitForExistence(timeout: 60))
    note.tap()
    let title = app.staticTexts.matching(identifier: "editor-toolbar-title").firstMatch
    waitUntil { title.exists && title.label == "How I Run an Open Source Project" }
    let editor = app.descendants(matching: .any).matching(identifier: "editor-panel").firstMatch
    XCUIDevice.shared.orientation = .portrait
    waitUntil { app.frame.width < app.frame.height }
    waitUntil { editor.frame.width >= 520 }
    XCTAssertEqual(title.label, "How I Run an Open Source Project")
    XCTAssertLessThan(editor.frame.maxX, app.frame.width + 1)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.lifetime = .keepAlways
    add(screenshot)
    app.buttons.matching(identifier: "editor-properties-action").firstMatch.tap()
    let properties = app.descendants(matching: .any).matching(identifier: "properties-panel").firstMatch
    XCTAssertTrue(properties.waitForExistence(timeout: 5))
    XCTAssertGreaterThanOrEqual(editor.frame.width, 520)
    XCUIDevice.shared.orientation = .landscapeLeft
    waitUntil { app.frame.width > app.frame.height }
    waitUntil { editor.frame.width >= 520 }
    XCTAssertEqual(title.label, "How I Run an Open Source Project")
    XCUIDevice.shared.orientation = .portrait
    app.buttons.matching(identifier: "editor-properties-action").firstMatch.tap()
    waitUntil { !properties.exists && editor.frame.width >= 520 }
    XCTAssertEqual(title.label, "How I Run an Open Source Project")
  }

  private func waitUntil(_ predicate: @escaping () -> Bool) {
    expectation(for: NSPredicate { _, _ in predicate() }, evaluatedWith: nil)
    waitForExpectations(timeout: 10)
  }
}
