import XCTest

final class TabletSyncConflictTests: XCTestCase {
  func testReviewKeepBothAndHistorySurviveRelaunch() throws {
    guard ProcessInfo.processInfo.environment["TOLARIA_QA_SYNC_CONFLICT"] == "1" else {
      throw XCTSkip("Requires isolated sync-conflict fixture")
    }
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .landscapeLeft
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=native-vault&editorMode=wysiwyg"]
    app.launch()
    openManager(app)
    XCTAssertTrue(app.staticTexts["Sync Conflict QA"].firstMatch.waitForExistence(timeout: 10))
    let reviewButton = app.buttons["review-sync-conflicts"].firstMatch
    XCTAssertTrue(reviewButton.waitForExistence(timeout: 10))
    reviewButton.tap()
    let review = element(app, "sync-conflict-review")
    XCTAssertTrue(review.waitForExistence(timeout: 30))
    assertVisible(app, text: "Local conflict body")
    assertVisible(app, text: "Remote conflict body")
    let apply = app.buttons["conflict-apply"].firstMatch
    XCTAssertFalse(apply.isEnabled)
    let both = app.buttons["conflict-choice-both"].firstMatch
    XCTAssertGreaterThanOrEqual(both.frame.height, 44)
    XCTAssertTrue(both.isHittable)
    both.tap()
    XCTAssertTrue(apply.isEnabled)
    capture(app)
    apply.tap()
    expectation(for: NSPredicate { _, _ in !review.exists }, evaluatedWith: nil)
    waitForExpectations(timeout: 30)
    XCTAssertTrue(localCommit(app).waitForExistence(timeout: 10))
    app.terminate()
    app.launch()
    openManager(app)
    XCTAssertTrue(localCommit(app).waitForExistence(timeout: 10))
    capture(app)
    app.buttons["Close"].firstMatch.tap()
  }

  func testSettingsCanCloseImmediatelyAfterConflictResolution() throws {
    try assertSettingsCloseAfterResolving(choice: "both")
  }

  func testSettingsCanCloseAfterKeepingMine() throws {
    try assertSettingsCloseAfterResolving(choice: "local")
  }

  func testSettingsCanCloseAfterKeepingTheirs() throws {
    try assertSettingsCloseAfterResolving(choice: "remote")
  }

  func testSettingsCanSwipeDismissImmediatelyAfterConflictResolution() throws {
    try assertSettingsCloseAfterResolving(choice: "both", swipeDismissal: true)
  }

  private func assertSettingsCloseAfterResolving(choice: String, swipeDismissal: Bool = false) throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=native-vault&editorMode=wysiwyg"]
    app.launch()
    dismissVaultNotices(app)
    openManager(app)
    dismissVaultNotices(app)
    guard app.staticTexts["Sync Conflict QA"].waitForExistence(timeout: 5) else {
      throw XCTSkip("Requires isolated sync-conflict fixture")
    }
    app.buttons["review-sync-conflicts"].firstMatch.tap()
    let review = element(app, "sync-conflict-review")
    XCTAssertTrue(review.waitForExistence(timeout: 30))
    dismissVaultNotices(app)
    app.buttons["conflict-choice-\(choice)"].firstMatch.tap()
    let apply = app.buttons["conflict-apply"].firstMatch
    XCTAssertTrue(apply.isEnabled)
    XCTAssertTrue(apply.isHittable, "Continue must be visible and tappable")
    apply.tap()
    let close = app.buttons["mobile-settings-close"].firstMatch
    XCTAssertTrue(close.waitForExistence(timeout: 30), "Settings should return after resolving conflicts")
    if swipeDismissal {
      let start = close.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
      let finish = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95))
      start.press(forDuration: 0.1, thenDragTo: finish)
    } else {
      close.tap()
    }

    expectation(for: NSPredicate { _, _ in !close.exists }, evaluatedWith: nil)
    waitForExpectations(timeout: 45)
    assertSettingsStaysDismissed(app, close: close)
    XCTAssertEqual(app.state, .runningForeground, "The app should remain in the foreground after dismissing Settings")
    capture(app)
  }

  func testSettingsCanBeDismissedAfterCancelWithASwipe() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=native-vault&editorMode=wysiwyg"]
    app.launch()
    dismissVaultNotices(app)
    openManager(app)
    dismissVaultNotices(app)
    guard app.staticTexts["Sync Conflict QA"].waitForExistence(timeout: 5) else {
      throw XCTSkip("Requires isolated sync-conflict fixture")
    }
    app.buttons["review-sync-conflicts"].firstMatch.tap()
    let review = element(app, "sync-conflict-review")
    XCTAssertTrue(review.waitForExistence(timeout: 30))
    let cancel = app.buttons["Cancel"].firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 10))
    cancel.tap()
    expectation(for: NSPredicate { _, _ in !review.exists }, evaluatedWith: nil)
    waitForExpectations(timeout: 15)

    let close = app.buttons["mobile-settings-close"].firstMatch
    XCTAssertTrue(close.waitForExistence(timeout: 10), "Cancel should return to dismissible Settings")
    let start = close.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let finish = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95))
    start.press(forDuration: 0.1, thenDragTo: finish)
    expectation(for: NSPredicate { _, _ in !close.exists }, evaluatedWith: nil)
    waitForExpectations(timeout: 15)
    assertSettingsStaysDismissed(app, close: close)
    XCTAssertEqual(app.state, .runningForeground)
    capture(app)
  }

  private func assertSettingsStaysDismissed(_ app: XCUIApplication, close: XCUIElement) {
    Thread.sleep(forTimeInterval: 3)
    XCTAssertFalse(close.exists, "Settings must not reappear after dismissal")
    let listControl = app.buttons["open-mobile-settings"].firstMatch
    XCTAssertTrue(listControl.waitForExistence(timeout: 10), "The note-list sidebar should remain available")
    XCTAssertTrue(listControl.isHittable, "The note list must be usable after dismissing Settings")
  }

  private func openManager(_ app: XCUIApplication) {
    let button = app.buttons["Manage vaults"].firstMatch
    if button.waitForExistence(timeout: 5) {
      button.tap()
    } else {
      app.buttons["phone-note-list-sidebar-button"].firstMatch.tap()
      let sidebarButton = app.buttons["open-mobile-settings"].firstMatch
      XCTAssertTrue(sidebarButton.waitForExistence(timeout: 10))
      sidebarButton.tap()
    }
    XCTAssertTrue(element(app, "vault-manager").waitForExistence(timeout: 10))
  }

  private func dismissVaultNotices(_ app: XCUIApplication) {
    for _ in 0..<2 {
      let dismiss = app.buttons["vault-notice-dismiss"].firstMatch
      guard dismiss.waitForExistence(timeout: 1) else { return }
      dismiss.tap()
    }
  }

  private func localCommit(_ app: XCUIApplication) -> XCUIElement {
    app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "Local commit:")).firstMatch
  }

  private func assertVisible(_ app: XCUIApplication, text: String) {
    let value = app.staticTexts.containing(
      NSPredicate(format: "label CONTAINS %@", text)
    ).firstMatch
    XCTAssertTrue(value.exists)
    XCTAssertTrue(app.frame.contains(value.frame))
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  private func capture(_ app: XCUIApplication) {
    let geometry = XCTAttachment(string: "Native app bounds: \(app.frame)")
    geometry.lifetime = .keepAlways
    add(geometry)
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
