import XCTest

final class MobileMotionFrameTests: XCTestCase {
  func testNewNoteHeaderAndBodyEnterTogether() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = launchMotionFixture(source: "host")
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
    let app = launchMotionFixture()

    let list = element(app, "phone-note-list-screen")
    XCTAssertTrue(list.waitForExistence(timeout: 30), "Initial list frame did not appear")
    let hamburger = element(app, "phone-note-list-sidebar-button")
    let create = element(app, "note-list-create-action")
    XCTAssertTrue(hamburger.exists && hamburger.isHittable, "Hamburger missing or not tappable on the first list frame")
    XCTAssertTrue(create.exists && create.isHittable, "FAB missing or not tappable on the first list frame")
    attachFrame("first-list-frame", app)

    element(app, "note-row-workflow-orchestration").tap()
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

    let row = element(app, "note-row-workflow-orchestration")
    XCTAssertTrue(row.waitForExistence(timeout: 8))
    row.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5))
      .press(forDuration: 0.05, thenDragTo: row.coordinate(withNormalizedOffset: CGVector(dx: 0.08, dy: 0.5)))
    attachFrame("organize-swipe", app)
  }

  private func launchMotionFixture(source: String = "fixture") -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    let search = "?source=\(source)&phoneState=list&editorMode=wysiwyg&layoutProbe=1&qaRun=tol339-motion"
    app.launchArguments = ["--tolaria-mobile-search", search]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = search
    app.launch()
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

  private func attachSamples(_ samples: [[String: Any]]) {
    do {
      let data = try JSONSerialization.data(withJSONObject: samples, options: [.sortedKeys])
      let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      attachment.name = "new-note-header-body-frame-samples"
      attachment.lifetime = .keepAlways
      add(attachment)
    } catch {
      XCTFail("Could not serialize new-note frame samples: \(error)")
    }
  }
}
