import UIKit
import XCTest

final class MobileFooterAlignmentTests: XCTestCase {
  func testListAndEditorFootersStayAlignedAcrossKeyboardRotationAndNavigation() throws {
    let tablet = UIDevice.current.userInterfaceIdiom == .pad
    XCUIDevice.shared.orientation = .portrait
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    let phoneState = tablet ? "" : "&phoneState=list"
    let search = "?source=fixture&editorMode=source&tabletPanels=all&selectedNoteId=workflow-orchestration\(phoneState)"
    app.launchArguments = ["--tolaria-mobile-search", "\(search)&qaRun=tol115-footer-alignment"]
    app.launch()
    defer { app.terminate() }

    if !tablet {
      let sidebarButton = element(app, "phone-note-list-sidebar-button")
      XCTAssertTrue(sidebarButton.waitForExistence(timeout: 30))
      sidebarButton.tap()
    }
    let essayType = element(app, "sidebar-item-essays")
    XCTAssertTrue(essayType.waitForExistence(timeout: 15))
    essayType.tap()

    let listFooter = element(app, "note-list-filter-pills")
    XCTAssertTrue(listFooter.waitForExistence(timeout: 30))
    let expectedHeight = listFooter.frame.height
    XCTAssertGreaterThan(expectedHeight, 0)
    attachScreen("\(tablet ? "ipad" : "iphone")-list-footer-unfocused")

    let editorFooter = element(app, "editor-formatting-toolbar")
    if !tablet {
      let noteRow = app.descendants(matching: .any)
        .matching(NSPredicate(format: "identifier BEGINSWITH %@", "note-row-")).firstMatch
      XCTAssertTrue(noteRow.waitForExistence(timeout: 15))
      noteRow.tap()
    }
    try verifyEditorFooter(app, editorFooter, listFooter, expectedHeight: expectedHeight, tablet: tablet)
  }

  private func verifyEditorFooter(_ app: XCUIApplication, _ editorFooter: XCUIElement, _ listFooter: XCUIElement,
                                  expectedHeight: CGFloat, tablet: Bool) throws {
    XCTAssertTrue(editorFooter.waitForExistence(timeout: 15))
    assertHeight(editorFooter, equals: expectedHeight, state: "editor unfocused")
    if tablet { assertAligned(listFooter, editorFooter, state: "editor unfocused") }
    attachScreen("\(tablet ? "ipad" : "iphone")-editor-unfocused")

    let source = element(app, "editor-markdown-input")
    XCTAssertTrue(source.waitForExistence(timeout: 10))
    source.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 8))
    assertHeight(editorFooter, equals: expectedHeight, state: "keyboard shown")
    if tablet { assertAligned(listFooter, editorFooter, state: "keyboard shown") }
    attachScreen("\(tablet ? "ipad" : "iphone")-keyboard-shown")
    element(app, "editor-hide-keyboard-action").tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 8))
    assertHeight(editorFooter, equals: expectedHeight, state: "keyboard hidden")
    if tablet { assertAligned(listFooter, editorFooter, state: "keyboard hidden") }
    attachScreen("\(tablet ? "ipad" : "iphone")-keyboard-hidden")

    XCUIDevice.shared.orientation = .landscapeLeft
    waitUntil { app.frame.width > app.frame.height }
    assertHeight(editorFooter, equals: expectedHeight, state: "after rotation")
    if tablet { assertAligned(listFooter, editorFooter, state: "after rotation") }
    attachScreen("\(tablet ? "ipad" : "iphone")-landscape")

    if tablet {
      let nextNote = app.descendants(matching: .any)
        .matching(NSPredicate(format: "identifier BEGINSWITH %@", "note-row-")).element(boundBy: 1)
      XCTAssertTrue(nextNote.waitForExistence(timeout: 10))
      nextNote.tap()
      waitUntil { editorFooter.isHittable }
      assertHeight(editorFooter, equals: listFooter.frame.height, state: "after note navigation")
      assertAligned(listFooter, editorFooter, state: "after note navigation")
      attachScreen("ipad-after-note-navigation")
    }
  }

  private func assertHeight(_ element: XCUIElement, equals expected: CGFloat, state: String) {
    XCTAssertEqual(element.frame.height, expected, accuracy: 1, state)
  }

  private func assertAligned(_ list: XCUIElement, _ editor: XCUIElement, state: String) {
    XCTAssertEqual(list.frame.minY, editor.frame.minY, accuracy: 1, "top edge: \(state)")
    XCTAssertEqual(list.frame.maxY, editor.frame.maxY, accuracy: 1, "bottom edge: \(state)")
  }

  private func element(_ app: XCUIApplication, _ id: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: id).firstMatch
  }

  private func waitUntil(_ condition: @escaping () -> Bool) {
    let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 10), .completed)
  }

  private func attachScreen(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
