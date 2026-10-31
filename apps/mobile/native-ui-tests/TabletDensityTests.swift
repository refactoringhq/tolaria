import XCTest

final class TabletDensityTests: XCTestCase {
  override func setUp() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .landscapeLeft
  }

  func testFixedDensityPreservesDocumentAndScalesNativeSidebarGeometry() {
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&editorMode=wysiwyg&layoutProbe=1&qaRun=density"]
    app.launch()
    let title = element(app, "editor-toolbar-title")
    XCTAssertTrue(title.waitForExistence(timeout: 30))
    let originalTitle = title.label
    assertSidebar(app, rowHeight: 38.4)
    assertMeasuredInsets(app, scale: 1.2)
    assertSectionLabelCoordinates(app)
    assertNoDensitySetting(app)
    XCTAssertEqual(title.label, originalTitle)
    record("tablet-fixed-120-density")
    app.terminate()
    app.launch()
    XCTAssertTrue(title.waitForExistence(timeout: 30))
    assertSidebar(app, rowHeight: 38.4)
    XCUIDevice.shared.orientation = .portrait
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    record("tablet-fixed-120-density-portrait")
    XCUIDevice.shared.orientation = .landscapeLeft
  }

  func testPhoneChromeUsesNativeRowMetrics() {
    XCUIDevice.shared.orientation = .portrait
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    app.launchArguments = ["--tolaria-mobile-search", "?source=fixture&phoneState=sidebar&layoutProbe=1&qaRun=density"]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = "?source=fixture&phoneState=sidebar&layoutProbe=1&qaRun=density"
    app.launch()
    XCTAssertTrue(element(app, "sidebar-item-inbox").waitForExistence(timeout: 30))
    assertPhoneSidebar(app, minimumRowHeight: 44)
    assertPhoneMetrics(app)
    assertSectionLabelCoordinates(app)
    assertNoDensitySetting(app)
    record("phone-native-chrome-metrics")
    app.terminate()

    let listApp = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    listApp.launchArguments = ["--tolaria-mobile-search", "?source=fixture&phoneState=list&layoutProbe=1&qaRun=density"]
    listApp.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = "?source=fixture&phoneState=list&layoutProbe=1&qaRun=density"
    listApp.launch()
    let listMetricsElement = element(listApp, "note-list-layout-metrics")
    XCTAssertTrue(listMetricsElement.waitForExistence(timeout: 30))
    assertPhoneNoteRow(listApp, metrics: NativeDensityMetrics(readout: listMetricsElement.label))
    record("phone-native-note-list-metrics")
  }

  private func assertNoDensitySetting(_ app: XCUIApplication) {
    element(app, "open-mobile-settings").tap()
    XCTAssertTrue(element(app, "settings-theme-system").waitForExistence(timeout: 5))
    for scale in ["1", "1.1", "1.2"] {
      XCTAssertFalse(element(app, "settings-scale-\(scale)").exists)
    }
    app.buttons["Close settings"].tap()
  }

  private func assertSidebar(_ app: XCUIApplication, rowHeight: CGFloat) {
    let row = element(app, "sidebar-item-inbox")
    XCTAssertTrue(row.waitForExistence(timeout: 5))
    XCTAssertEqual(row.frame.height, rowHeight, accuracy: 1, "Measured sidebar row height")
  }

  private func assertPhoneSidebar(_ app: XCUIApplication, minimumRowHeight: CGFloat) {
    let row = element(app, "sidebar-item-inbox")
    XCTAssertTrue(row.waitForExistence(timeout: 5))
    XCTAssertGreaterThanOrEqual(row.frame.height, minimumRowHeight - 1)
  }

  private func record(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  private func assertPhoneMetrics(_ app: XCUIApplication) {
    let sidebar = NativeDensityMetrics(readout: element(app, "sidebar-layout-metrics").label)
    for item in ["inbox", "all-notes", "archive", "personal-journal", "essays"] {
      let prefix = "sidebar.item.\(item)"
      XCTAssertGreaterThanOrEqual(sidebar.frame("\(prefix).label").height, 22)
    }
    XCTAssertFalse(element(app, "sidebar.item.inbox.count.container").exists)
    XCTAssertGreaterThanOrEqual(sidebar.frame("sidebar.item.inbox.count.text").height, 22)
    XCTAssertGreaterThanOrEqual(sidebar.frame("sidebar.folder.writing.row").height, 44)
    XCTAssertGreaterThanOrEqual(sidebar.frame("sidebar.folder.writing.label").height, 22)
  }

  private func assertPhoneNoteRow(_ app: XCUIApplication, metrics: NativeDensityMetrics) {
    guard let frameId = metrics.firstFrameId(prefix: "noteList.item.", suffix: ".frame") else {
      XCTFail("No native note-row frame was captured")
      return
    }

    let firstRow = app.descendants(matching: .any)
      .matching(NSPredicate(format: "identifier BEGINSWITH %@", "note-row-"))
      .firstMatch
    XCTAssertTrue(firstRow.waitForExistence(timeout: 5))
    XCTAssertGreaterThanOrEqual(metrics.frame(frameId).height, 44)
    XCTAssertGreaterThanOrEqual(metrics.frame(frameId.replacingOccurrences(of: ".frame", with: ".title")).height, 22)
    XCTAssertGreaterThanOrEqual(metrics.frame(frameId.replacingOccurrences(of: ".frame", with: ".subtitle")).height, 20)
  }

  private func assertMeasuredInsets(_ app: XCUIApplication, scale: Double) {
    let sidebar = NativeDensityMetrics(readout: element(app, "sidebar-layout-metrics").label)
    print("DENSITY_NATIVE_METRICS scale=\(scale) \(sidebar.readout)")
    for item in ["inbox", "all-notes", "archive", "personal-journal", "essays"] {
      let prefix = "sidebar.item.\(item)"
      let content = sidebar.frame("\(prefix).content")
      XCTAssertEqual(content.minX, 12 * scale, accuracy: 0.6)
      XCTAssertEqual(content.minY, 6 * scale, accuracy: 0.6)
      // CoreText rounds ascent/descent independently; allow one point for the line box only.
      XCTAssertEqual(sidebar.frame("\(prefix).label").height, 18 * scale, accuracy: 1)
    }
    let pill = sidebar.frame("sidebar.item.inbox.count.container")
    let count = sidebar.frame("sidebar.item.inbox.count.text")
    XCTAssertEqual(pill.height, 20 * scale, accuracy: 0.6)
    XCTAssertEqual(count.midY, pill.height / 2, accuracy: 0.6)
    let folder = sidebar.frame("sidebar.folder.writing.row")
    let folderContent = sidebar.frame("sidebar.folder.writing.content")
    XCTAssertEqual(folder.height, 30 * scale, accuracy: 0.6)
    XCTAssertEqual(folderContent.minX, 12 * scale, accuracy: 0.6)
    XCTAssertEqual(folderContent.minY, 6 * scale, accuracy: 0.6)
  }

  private func assertSectionLabelCoordinates(_ app: XCUIApplication) {
    let sidebar = NativeDensityMetrics(readout: element(app, "sidebar-layout-metrics").label)
    for section in ["favorites", "views", "types", "folders"] {
      let prefix = "sidebar.section.\(section)"
      let row = sidebar.frame("\(prefix).row")
      let toggle = sidebar.frame("\(prefix).toggle")
      let label = sidebar.frame("\(prefix).label")
      XCTAssertEqual(toggle.minY + label.midY, row.height / 2, accuracy: 1)
    }
  }

  private func element(_ app: XCUIApplication, _ identifier: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: identifier).firstMatch
  }
}

private struct NativeDensityMetrics {
  let readout: String

  func firstFrameId(prefix: String, suffix: String) -> String? {
    readout
      .split(separator: "|")
      .first(where: { $0.hasPrefix(prefix) && $0.contains("\(suffix):") })
      .map { String($0.split(separator: ":", maxSplits: 1)[0]) }
  }

  func frame(_ identifier: String, file: StaticString = #filePath, line: UInt = #line) -> CGRect {
    let prefix = identifier + ":"
    guard let row = readout.split(separator: "|").first(where: { $0.hasPrefix(prefix) }) else {
      XCTFail("Missing native layout metric: \(identifier)", file: file, line: line)
      return .null
    }
    let values = row.dropFirst(prefix.count).split(separator: ",").compactMap { Double($0) }
    guard values.count == 4 else {
      XCTFail("Invalid native layout metric: \(identifier)", file: file, line: line)
      return .null
    }
    return CGRect(x: values[0], y: values[1], width: values[2], height: values[3])
  }
}
