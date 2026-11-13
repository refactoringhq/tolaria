import XCTest

final class MobileMotionFrameTests: XCTestCase {
  func testNoteOpenBodyRenderCountViaEditorEntryRoute() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()
    XCTAssertTrue(
      element(app, "phone-editor-screen").waitForExistence(timeout: 30),
      "The note-entry route did not open the editor"
    )
    XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30), "Editor body did not mount")
    attachFrame("note-open-editor-entry", app)
  }

  func testLargeVaultLaunchKeepsListChromeReachable() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()
    let list = element(app, "phone-note-list-screen")
    XCTAssertTrue(list.waitForExistence(timeout: 60), "List did not appear after the large-vault launch")
    XCTAssertTrue(
      element(app, "note-row-note-6000.md").waitForExistence(timeout: 8),
      "The generated large-vault note did not load"
    )

    let hamburger = element(app, "phone-note-list-sidebar-button")
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(
      hamburger.exists && hamburger.isHittable,
      "Hamburger missing or not tappable after large-vault launch"
    )
    XCTAssertTrue(create.exists && create.isHittable, "FAB missing or not tappable after large-vault launch")
    attachFrame("large-vault-first-list-frame", app)
  }

  func testCachedStartupKeepsFirstFrameChromeUsable() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()
    let list = element(app, "phone-note-list-screen")
    let hamburger = element(app, "phone-note-list-sidebar-button")
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(
      list.waitForExistence(timeout: 8),
      "Cached preview did not keep the list mounted during delayed preparation"
    )
    XCTAssertTrue(
      hamburger.exists && hamburger.isHittable,
      "Hamburger was not usable on the cached-preview first frame"
    )
    XCTAssertTrue(
      create.exists && create.isHittable,
      "Create action was not usable on the cached-preview first frame"
    )
    attachFrame("cached-startup-first-frame", app)

    hamburger.tap()
    XCTAssertTrue(
      element(app, "phone-sidebar-screen").waitForExistence(timeout: 3),
      "Hamburger did not open the sidebar during preparation"
    )
    element(app, "sidebar-item-inbox").tap()
    XCTAssertTrue(list.waitForExistence(timeout: 3), "Selecting Inbox did not return to the list")
    create.tap()
    XCTAssertTrue(
      element(app, "phone-editor-screen").waitForExistence(timeout: 70),
      "Create action did not open the editor during preparation"
    )
  }

  func testCachedStartupCreateActionAcceptsFirstFrameTapWhilePreparationRuns() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()
    let list = element(app, "phone-note-list-screen")
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(list.waitForExistence(timeout: 8), "List did not appear during delayed preparation")
    XCTAssertTrue(create.exists && create.isHittable, "Create action was not usable on the first list frame")
    attachFrame("cached-startup-create-first-frame", app)

    create.tap()
    let editor = element(app, "phone-editor-screen")
    XCTAssertTrue(
      editor.waitForExistence(timeout: 8),
      "Create action did not mount the editor during preparation"
    )
    let editorBody = app.webViews.firstMatch
    XCTAssertTrue(
      editorBody.waitForExistence(timeout: 8),
      "Create action did not make the editor body reachable during preparation"
    )
    let editorBodyIsReachable = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "isHittable == true"),
      object: editorBody
    )
    XCTAssertEqual(
      XCTWaiter.wait(for: [editorBodyIsReachable], timeout: 8),
      .completed,
      "Create action did not expose an interactive editor body during preparation"
    )
    attachFrame("cached-startup-create-action-tapped", app)
  }

  func testNewNoteHeaderAndBodyEnterTogether() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(create.waitForExistence(timeout: 30), "Create action did not appear")

    create.tap()
    let toolbar = element(app, "editor-toolbar")
    let body = app.webViews.firstMatch
    var samples: [[String: Any]] = []
    for _ in 0..<180 where !(toolbar.exists && body.exists) {
      let timestamp = ProcessInfo.processInfo.systemUptime
      if toolbar.exists { samples.append(frameSample("header", toolbar, timestamp)) }
      if body.exists { samples.append(frameSample("body", body, timestamp)) }
      RunLoop.current.run(until: Date().addingTimeInterval(1.0 / 60.0))
    }

    XCTAssertTrue(toolbar.waitForExistence(timeout: 8), "New-note header did not mount")
    XCTAssertTrue(body.waitForExistence(timeout: 8), "New-note body did not mount")
    let timestamp = ProcessInfo.processInfo.systemUptime
    samples.append(frameSample("header", toolbar, timestamp))
    samples.append(frameSample("body", body, timestamp))
    attachSamples(samples)
  }

  func testListChromeEditorReturnSidebarCloseAndOrganizeSwipeAreReachable() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()

    let list = element(app, "phone-note-list-screen")
    XCTAssertTrue(list.waitForExistence(timeout: 30), "Initial list frame did not appear")
    let hamburger = element(app, "phone-note-list-sidebar-button")
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(hamburger.exists && hamburger.isHittable, "Hamburger missing or not tappable on the first list frame")
    XCTAssertTrue(create.exists && create.isHittable, "FAB missing or not tappable on the first list frame")
    attachFrame("first-list-frame", app)

    let note = element(app, "note-row-note-6000.md")
    XCTAssertTrue(note.waitForExistence(timeout: 10), "Cached/generated note row did not appear")
    note.tap()
    XCTAssertTrue(element(app, "phone-editor-screen").waitForExistence(timeout: 8))
    XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 8), "Note body did not mount")
    MobilePanelNavigation.back(app)
    XCTAssertTrue(list.waitForExistence(timeout: 8))
    XCTAssertTrue(create.isHittable, "FAB did not return with the list")

    hamburger.tap()
    XCTAssertTrue(element(app, "phone-sidebar-screen").waitForExistence(timeout: 8))
    element(app, "sidebar-item-inbox").tap()
    XCTAssertTrue(list.waitForExistence(timeout: 8))
    XCTAssertTrue(create.isHittable, "FAB did not return after sidebar close")

    let row = element(app, "note-row-workflow-orchestration.md")
    XCTAssertTrue(row.waitForExistence(timeout: 8))
    row.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5))
      .press(forDuration: 0.05, thenDragTo: row.coordinate(withNormalizedOffset: CGVector(dx: 0.08, dy: 0.5)))
    attachFrame("organize-swipe", app)
  }

  func testOrganizeSwipeDismissesOnlyAfterFullReveal() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = attachToMotionFixture()
    let list = element(app, "phone-note-list-screen")
    XCTAssertTrue(list.waitForExistence(timeout: 60), "Large QA vault list did not appear")
    XCTAssertTrue(element(app, "phone-note-list-sidebar-button").isHittable)
    XCTAssertTrue(element(app, "note-list-create-action").isHittable)
    attachFrame("organize-swipe-before", app)

    let rows = visibleNoteRows(in: app)
    guard let row = rows.first, rows.count > 1 else {
      XCTFail("Could not locate two visible Inbox rows for the organize swipe")
      return
    }
    let rowQuery = element(app, row.identifier)
    let followingRowIdentifier = rows[1].identifier
    let initialFollowingY = element(app, followingRowIdentifier).frame.minY
    recordOrganizeSwipeFrames(row, app, followingRowIdentifier)
    XCTAssertTrue(
      rowQuery.waitForNonExistence(timeout: 5),
      "Organize action did not dismiss the full-swiped row"
    )
    let followingRowAfter = element(app, followingRowIdentifier)
    XCTAssertLessThan(
      followingRowAfter.frame.minY,
      initialFollowingY - 20,
      "The next row did not move into the organized row's space"
    )
    attachFrame("organize-swipe-after", app)
  }

  private func attachToMotionFixture() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: MotionHarnessConfiguration.appBundleIdentifier)
    app.launchArguments = ["--tolaria-mobile-search", MotionHarnessConfiguration.launchSearch]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = MotionHarnessConfiguration.launchSearch
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10), "The scripted motion fixture did not launch")
    return app
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  private func attachFrame(_ name: String, _ app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    XCTAssertTrue(app.state == .runningForeground)
  }

  private func frameSample(
    _ element: String,
    _ target: XCUIElement,
    _ timestamp: TimeInterval
  ) -> [String: Any] {
    let frame = target.frame
    return [
      "element": element,
      "atUptime": timestamp,
      "x": frame.minX,
      "y": frame.minY,
      "width": frame.width,
      "height": frame.height
    ]
  }

  private func attachSamples(_ samples: [[String: Any]], named name: String = "new-note-header-body-frame-samples") {
    do {
      let data = try JSONSerialization.data(withJSONObject: samples, options: [.sortedKeys])
      let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      attachment.name = name
      attachment.lifetime = .keepAlways
      add(attachment)
    } catch {
      XCTFail("Could not serialize new-note frame samples: \(error)")
    }
  }
}

final class MobileOrganizeRevealFrameTests: XCTestCase {
  func testOrganizeFullSwipeShowsOnlyFullWidthCheckBeforeCollapse() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = XCUIApplication(bundleIdentifier: MotionHarnessConfiguration.appBundleIdentifier)
    app.launchArguments = ["--tolaria-mobile-search", MotionHarnessConfiguration.launchSearch]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = MotionHarnessConfiguration.launchSearch
    app.launch()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
    let list = element(app, "phone-note-list-screen")
    XCTAssertTrue(list.waitForExistence(timeout: 60), "The note list did not load")
    let rows = visibleNoteRows(in: app)
    guard rows.count > 1 else {
      XCTFail("Could not locate two visible Inbox rows for the full-reveal assertion")
      return
    }
    let row = rows[0]
    let initialRowFrame = row.frame
    let following = element(app, rows[1].identifier)
    let initialFollowingY = following.frame.minY
    let noteId = row.identifier.replacingOccurrences(of: "note-row-", with: "")
    performFullLeftSwipe(on: row)
    assertFullSwipeReveal(app, initialRowFrame: initialRowFrame, noteId: noteId)
    XCTAssertTrue(element(app, row.identifier).waitForNonExistence(timeout: 5))
    XCTAssertLessThan(following.frame.minY, initialFollowingY - 20)
    attachFrame("organize-swipe-collapse", app)
  }

  private func assertFullSwipeReveal(
    _ app: XCUIApplication,
    initialRowFrame: CGRect,
    noteId: String
  ) {
    RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    let screenshot = XCUIScreen.main.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = "organize-swipe-100-full-row"
    attachment.lifetime = .keepAlways
    add(attachment)
    let frameReport = "row=\(initialRowFrame)"
    let frameAttachment = XCTAttachment(string: frameReport)
    frameAttachment.name = "organize-swipe-frame-coordinates"
    frameAttachment.lifetime = .keepAlways
    add(frameAttachment)
    let pixels = MotionScreenshotPixels.measureGreenRow(screenshot.image, rowFrame: initialRowFrame)
    XCTAssertGreaterThanOrEqual(
      pixels.greenCoverage,
      0.99,
      "Green pixel coverage was \(pixels.greenCoverage) for \(frameReport)"
    )
    XCTAssertGreaterThan(pixels.checkPixels, 5, "Centered check icon was absent or clipped")
    XCTAssertFalse(element(app, "note-swipe-favorite-\(noteId)").exists)
    XCTAssertFalse(element(app, "note-swipe-delete-\(noteId)").exists)
    XCTAssertFalse(app.staticTexts["Organize selected notes"].exists)
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }

  private func visibleNoteRows(in app: XCUIApplication) -> [XCUIElement] {
    app.descendants(matching: .any)
      .matching(NSPredicate(format: "identifier BEGINSWITH %@", "note-row-"))
      .allElementsBoundByIndex
      .filter { $0.isHittable }
      .sorted { $0.frame.minY < $1.frame.minY }
  }

  private func performFullLeftSwipe(on row: XCUIElement) {
    row.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).press(
      forDuration: 0.05,
      thenDragTo: row.coordinate(withNormalizedOffset: CGVector(dx: 0.08, dy: 0.5)),
      withVelocity: XCUIGestureVelocity(rawValue: 300),
      thenHoldForDuration: 0.05
    )
  }

  private func attachFrame(_ name: String, _ app: XCUIApplication) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    XCTAssertEqual(app.state, .runningForeground)
  }
}

private extension MobileMotionFrameTests {
  func visibleNoteRows(in app: XCUIApplication) -> [XCUIElement] {
    app.descendants(matching: .any)
      .matching(NSPredicate(format: "identifier BEGINSWITH %@", "note-row-"))
      .allElementsBoundByIndex
      .filter { $0.isHittable }
      .sorted { $0.frame.minY < $1.frame.minY }
  }

  func recordOrganizeSwipeFrames(
    _ row: XCUIElement,
    _ app: XCUIApplication,
    _ followingRowIdentifier: String
  ) {
    let rowQuery = element(app, row.identifier)
    var rowSamples: [[String: Any]] = []
    performFullLeftSwipe(on: row)
    for frame in 0..<24 {
      appendVisibleRowSamples(rowQuery, app, followingRowIdentifier, &rowSamples)
      if frame.isMultiple(of: 2) {
        attachFrame(String(format: "organize-swipe-frame-%02d", frame), app)
      }
      RunLoop.current.run(until: Date().addingTimeInterval(1.0 / 60.0))
    }
    attachSamples(rowSamples, named: "organize-swipe-native-row-geometry")
  }

  func performFullLeftSwipe(on row: XCUIElement, hold: TimeInterval = 0.35) {
    row.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).press(
      forDuration: 0.05,
      thenDragTo: row.coordinate(withNormalizedOffset: CGVector(dx: 0.08, dy: 0.5)),
      withVelocity: XCUIGestureVelocity(rawValue: 300),
      thenHoldForDuration: hold
    )
  }

  func appendVisibleRowSamples(
    _ row: XCUIElement,
    _ app: XCUIApplication,
    _ followingRowIdentifier: String,
    _ samples: inout [[String: Any]]
  ) {
    let timestamp = ProcessInfo.processInfo.systemUptime * 1000
    if row.exists { samples.append(frameSample("row", row, timestamp)) }
    let following = element(app, followingRowIdentifier)
    if following.exists { samples.append(frameSample("following", following, timestamp)) }
  }
}
