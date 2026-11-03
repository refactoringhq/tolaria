import UIKit
import XCTest

final class MobileFormattingKeyboardTests: XCTestCase {
  func testRichFormattingDismissalAndDraftSurviveRotation() throws { try verify(mode: "wysiwyg") }
  func testSourceFormattingDismissalAndDraftSurviveRotation() throws { try verify(mode: "source") }

  func testTabletKeepsWideFormattingActions() throws {
    try XCTSkipUnless(UIDevice.current.userInterfaceIdiom == .pad, "Tablet-only wide toolbar")
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&editorMode=source&qaRun=tablet-format-toolbar"]
    app.launch()
    defer { app.terminate() }
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(create.waitForExistence(timeout: 30))
    create.tap()
    let source = element(app, "editor-markdown-input")
    XCTAssertTrue(source.waitForExistence(timeout: 15))
    source.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    source.typeText("Tablet raw draft")
    XCTAssertTrue((source.value as? String ?? "").contains("Tablet raw draft"))
    XCTAssertTrue(element(app, "editor-format-wikilink").waitForExistence(timeout: 15))
    XCTAssertFalse(element(app, "editor-format-menu-insert").exists)
    XCTAssertFalse(element(app, "editor-format-menu-more").exists)
    attachScreen("tablet-wide-formatting-unchanged")
  }

  func testPhoneGlassToolbarControlsRemainTappable() throws {
    try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad, "Phone-specific compact toolbar")
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = [
      "--tolaria-mobile-search",
      "?source=fixture&phoneState=list&editorMode=source&qaRun=phone-glass-toolbar"
    ]
    app.launch()
    defer { app.terminate() }

    let create = element(app, "phone-note-list-create")
    XCTAssertTrue(create.waitForExistence(timeout: 30))
    create.tap()
    let source = element(app, "editor-markdown-input")
    XCTAssertTrue(source.waitForExistence(timeout: 15))
    source.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    XCUIDevice.shared.orientation = .landscapeLeft
    waitUntil { app.frame.width > app.frame.height }

    let toolbar = element(app, "editor-formatting-toolbar")
    let glass = element(app, "editor-formatting-glass")
    XCTAssertTrue(toolbar.waitForExistence(timeout: 8))
    XCTAssertTrue(glass.waitForExistence(timeout: 8))
    XCTAssertGreaterThan(glass.frame.width, toolbar.frame.width - 24)
    let bold = app.buttons["editor-format-bold"]
    XCTAssertTrue(bold.waitForExistence(timeout: 5))
    XCTAssertTrue(bold.isHittable)
    bold.tap()
    let headings = app.buttons["editor-format-menu-headings"]
    XCTAssertTrue(headings.waitForExistence(timeout: 5))
    XCTAssertTrue(headings.isHittable)
    headings.tap()
    let heading2 = app.buttons["Heading 2"]
    XCTAssertTrue(heading2.waitForExistence(timeout: 5))
    heading2.tap()
    attachScreen("phone-glass-toolbar-tappable")
  }

  private func verify(mode: String) throws {
    try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad, "Phone-specific compact toolbar")
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = [
      "--tolaria-mobile-search",
      "?source=fixture&phoneState=list&editorMode=\(mode)&qaRun=phone-format-keyboard"
    ]
    app.launch()
    defer { app.terminate() }
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(create.waitForExistence(timeout: 30))
    create.tap()
    let input = mode == "source" ? element(app, "editor-markdown-input") : app.webViews.textViews.firstMatch
    XCTAssertTrue(input.waitForExistence(timeout: 15))
    input.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    input.typeText("Phone formatting draft")
    if mode == "source" {
      XCTAssertTrue(
        (input.value as? String ?? "").contains("Phone formatting draft"),
        input.value as? String ?? ""
      )
    }
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    assertDismissTarget(app)
    attachScreen("\(mode)-portrait-keyboard")
    verifyLandscapeAndResume(app, input: input, isSource: mode == "source")
    assertOverflowActions(app, mode: mode)
    assertSourceDraft(app, mode: mode)
  }

  private func verifyLandscapeAndResume(
    _ app: XCUIApplication,
    input: XCUIElement,
    isSource: Bool
  ) {
    XCUIDevice.shared.orientation = .landscapeLeft
    waitUntil { app.frame.width > app.frame.height }
    assertDismissTarget(app)
    let headings = element(app, "editor-format-menu-headings")
    XCTAssertTrue(headings.isHittable)
    headings.tap()
    let heading = element(app, "editor-format-heading-2")
    XCTAssertTrue(heading.waitForExistence(timeout: 5))
    heading.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    input.typeText(" landscape")
    attachScreen(isSource ? "source-landscape-caret" : "wysiwyg-landscape-caret")
    element(app, "editor-hide-keyboard-action").tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 8))
    XCTAssertTrue(element(app, "editor-hide-keyboard-action").waitForNonExistence(timeout: 5))
    let stayedHidden = XCTNSPredicateExpectation(
      predicate: NSPredicate { _, _ in app.keyboards.firstMatch.exists },
      object: nil
    )
    stayedHidden.isInverted = true
    wait(for: [stayedHidden], timeout: 2)
    XCUIDevice.shared.orientation = .portrait
    waitUntil { app.frame.height > app.frame.width }
    input.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    input.typeText(" resumed")
    attachScreen(isSource ? "source-portrait-resumed-caret" : "wysiwyg-portrait-resumed-caret")
  }

  private func assertOverflowActions(_ app: XCUIApplication, mode: String) {
    element(app, "editor-format-menu-more").tap()
    let strike = element(app, "editor-format-strike")
    XCTAssertTrue(strike.waitForExistence(timeout: 5))
    XCTAssertTrue(strike.isHittable)
    strike.tap()
    element(app, "editor-format-menu-insert").tap()
    let wikilink = element(app, "editor-format-wikilink")
    XCTAssertTrue(wikilink.waitForExistence(timeout: 5))
    XCTAssertTrue(wikilink.isHittable)
    wikilink.tap()
    if mode == "source" {
      XCTAssertTrue((element(app, "editor-markdown-input").value as? String ?? "").contains("[["))
    } else {
      XCTAssertTrue(element(app, "editor-wysiwyg-wikilink-picker").waitForExistence(timeout: 5))
      element(app, "editor-wysiwyg-wikilink-backdrop")
        .coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.1))
        .tap()
    }
  }

  private func assertSourceDraft(_ app: XCUIApplication, mode: String) {
    if mode != "source" { element(app, "editor-source-action").tap() }
    let source = element(app, "editor-markdown-input")
    XCTAssertTrue(source.waitForExistence(timeout: 8))
    let text = source.value as? String ?? ""
    XCTAssertTrue(text.contains("Phone formatting draft"), text)
    XCTAssertTrue(text.contains("landscape"))
    XCTAssertTrue(text.contains("resumed"))
    XCTAssertTrue(text.contains("type: Note"))
    XCTAssertTrue(text.contains("## "))
  }

  private func assertDismissTarget(_ app: XCUIApplication) {
    assertPinnedActions(app)
    let button = element(app, "editor-hide-keyboard-action")
    XCTAssertTrue(button.waitForExistence(timeout: 5))
    XCTAssertTrue(button.isHittable)
    XCTAssertGreaterThanOrEqual(button.frame.width, 43.99)
    XCTAssertGreaterThanOrEqual(button.frame.height, 43.99)
    XCTAssertTrue(app.frame.contains(button.frame))
    let keyboard = app.keyboards.firstMatch
    let surfaces = [keyboard, app.buttons["assistantUndo"], app.otherElements["Typing Predictions"]]
    let top = surfaces.filter { $0.exists }.map { $0.frame.minY }.min() ?? keyboard.frame.minY
    waitUntil { button.frame.maxY <= top + 2 }
  }

  private func assertPinnedActions(_ app: XCUIApplication) {
    let controls = ["editor-format-menu-insert", "editor-format-menu-more", "editor-hide-keyboard-action"]
      .map { element(app, $0) }
    for control in controls {
      XCTAssertTrue(control.waitForExistence(timeout: 5))
      XCTAssertTrue(control.isHittable)
      XCTAssertGreaterThanOrEqual(control.frame.width, 43.99)
      XCTAssertGreaterThanOrEqual(control.frame.height, 43.99)
      XCTAssertTrue(app.frame.contains(control.frame))
    }
    for index in 1..<controls.count {
      XCTAssertGreaterThanOrEqual(controls[index].frame.minX, controls[index - 1].frame.maxX - 0.5)
      XCTAssertEqual(controls[index].frame.midY, controls[0].frame.midY, accuracy: 0.5)
    }
  }

  private func element(_ app: XCUIApplication, _ id: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: id).firstMatch
  }

  private func waitUntil(_ condition: @escaping () -> Bool) {
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 8), .completed)
  }

  private func attachScreen(_ name: String) {
    let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    image.name = name
    image.lifetime = .keepAlways
    add(image)
  }
}
