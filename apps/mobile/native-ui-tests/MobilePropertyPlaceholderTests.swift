import XCTest
import UIKit

final class MobilePropertyPlaceholderTests: XCTestCase {
  func testEmptyPropertyHasTrailingActionAndOpensItsEditor() {
    let app = launchProperties()
    defer { app.terminate() }
    let row = element(app, "property-placeholder-type-derived-priority")
    XCTAssertTrue(row.waitForExistence(timeout: 30))
    scrollTo(row, in: app)
    XCTAssertTrue(row.isHittable)
    let action = row.staticTexts.matching(NSPredicate(format: "label == %@", "Add property")).firstMatch
    XCTAssertTrue(action.exists)
    let label = element(app, "property-placeholder-type-derived-priority-label")
    XCTAssertGreaterThanOrEqual(action.frame.minX, label.frame.maxX)
    XCTAssertLessThanOrEqual(action.frame.maxX, row.frame.maxX)
    let panel = element(app, "properties-panel")
    XCTAssertTrue(panel.frame.contains(row.frame))
    let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screenshot.name = "empty-properties-trailing-action"
    screenshot.lifetime = .keepAlways
    add(screenshot)
    let detail = XCTAttachment(screenshot: row.screenshot())
    detail.name = "empty-property-row"
    detail.lifetime = .keepAlways
    add(detail)
    row.tap()
    XCTAssertTrue(element(app, "workspace-property-name-input").waitForExistence(timeout: 5))
    XCTAssertEqual(element(app, "workspace-property-name-input").value as? String, "Priority")
    element(app, "workspace-property-cancel-action").tap()
    XCTAssertTrue(row.isHittable)
  }

  func testPopulatedRelationshipsPrecedePhoneSuggestionsWithoutChangingTabletOrder() {
    let app = launchProperties()
    defer { app.terminate() }
    let relationship = element(app, "property-section-belongsTo")
    let placeholder = element(app, "property-placeholder-type-derived-priority")
    XCTAssertTrue(relationship.waitForExistence(timeout: 5))
    XCTAssertTrue(placeholder.exists)
    XCTAssertGreaterThan(relationship.frame.height, 0)
    XCTAssertGreaterThan(placeholder.frame.height, 0)
    if UIDevice.current.userInterfaceIdiom == .phone {
      XCTAssertLessThan(relationship.frame.maxY, placeholder.frame.minY)
    } else {
      XCTAssertLessThan(placeholder.frame.maxY, relationship.frame.minY)
    }
  }

  func testSearchAndRelationshipChipsKeepTheirIntendedLayout() {
    let app = launchSearchFixture(phoneState: "list&commandPalette=1")
    let command = element(app, "mobile-command-palette-command-file-quick-open")
    XCTAssertTrue(command.waitForExistence(timeout: 10))
    command.tap()
    let input = element(app, "workspace-search-input")
    XCTAssertTrue(input.waitForExistence(timeout: 5))
    input.tap()
    input.typeText("luca")
    let result = element(app, "workspace-search-result-newsletter-calendar-view-proposal.md")
    XCTAssertTrue(result.waitForExistence(timeout: 10))
    capture("tol350-search-results")
    let rowId = "newsletter-calendar-view-proposal.md"
    let title = element(app, "workspace-search-result-title-\(rowId)")
    let snippet = element(app, "workspace-search-result-snippet-\(rowId)")
    let icon = element(app, "workspace-search-result-icon-\(rowId)")
    XCTAssertTrue(title.exists)
    XCTAssertTrue(snippet.exists)
    XCTAssertTrue(icon.exists)
    XCTAssertEqual(icon.frame.midY, title.frame.midY, accuracy: 3)
    XCTAssertGreaterThan(title.frame.minX, result.frame.minX + 16)
    XCTAssertEqual(title.frame.minX, snippet.frame.minX, accuracy: 2)

    let properties = launchSearchFixture(phoneState: "properties")
    let panel = element(properties, "properties-panel")
    XCTAssertTrue(panel.waitForExistence(timeout: 15))
    capture("tol350-properties-related-chips")
    XCTAssertFalse(element(properties, "relationship-placeholder-suggested-related-to").exists,
      "A spaced existing relationship must not produce a duplicate canonical suggestion")
    let weekly = element(properties, "relationship-row-refactoring-weekly-sponsorships")
    let calendar = element(properties, "relationship-row-sponsorships-calendar")
    XCTAssertTrue(weekly.waitForExistence(timeout: 5))
    XCTAssertTrue(calendar.waitForExistence(timeout: 5))
    XCTAssertLessThan(weekly.frame.width, panel.frame.width * 0.85)
    XCTAssertLessThan(calendar.frame.width, panel.frame.width * 0.85)
    let weeklyRemove = element(properties, "relationship-row-refactoring-weekly-sponsorships-remove")
    XCTAssertEqual(weekly.frame.midY, weeklyRemove.frame.midY, accuracy: 2)
  }

  private func launchSearchFixture(phoneState: String) -> XCUIApplication {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.terminate()
    let search = "?source=fixture&scenario=search-and-properties&phoneState=\(phoneState)&qaRun=tol350-styling"
    app.launchArguments = ["--tolaria-mobile-search", search]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = search
    app.launch()
    return app
  }

  private func launchProperties() -> XCUIApplication {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.terminate()
    XCUIDevice.shared.orientation = UIDevice.current.userInterfaceIdiom == .pad ? .landscapeLeft : .portrait
    let search = "?source=fixture&phoneState=properties&forceDesktopPanels=1&qaRun=property-placeholder"
    app.launchArguments = ["--tolaria-mobile-search", search]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = search
    app.launch()
    XCTAssertTrue(element(app, "properties-panel").waitForExistence(timeout: 5)
      || element(app, "editor-panel").waitForExistence(timeout: 30))
    if !element(app, "properties-panel").exists { MobilePanelNavigation.toggleProperties(app) }
    return app
  }

  private func scrollTo(_ row: XCUIElement, in app: XCUIApplication) {
    let panel = element(app, "properties-panel")
    for _ in 0..<8 where !row.isHittable || !panel.frame.contains(row.frame) {
      panel.swipeUp()
    }
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  private func capture(_ name: String) {
    let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screenshot.name = name
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }
}
