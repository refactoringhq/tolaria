import XCTest

final class PhoneEditorHeaderTests: XCTestCase {
  func testFloatingEditorChromeBackAndMenuAreTappable() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    let app = XCUIApplication(bundleIdentifier: "com.tolaria.mobile.dev")
    let search = "?source=fixture&phoneState=list&editorMode=wysiwyg&qaRun=phone-glass-chrome"
    app.launchArguments = ["--tolaria-mobile-search", search]
    app.launchEnvironment["TOLARIA_MOBILE_SEARCH"] = search
    let metroPort = ProcessInfo.processInfo.environment["TOLARIA_MOBILE_QA_METRO_PORT"] ?? "8081"
    app.launchEnvironment["RCT_METRO_PORT"] = metroPort
    app.launch()
    let row = element(app, "note-row-workflow-orchestration")
    XCTAssertTrue(row.waitForExistence(timeout: 30))
    row.tap()
    let chrome = element(app, "phone-editor-glass-chrome")
    XCTAssertTrue(chrome.waitForExistence(timeout: 10))
    XCTAssertFalse(element(app, "phone-top-bar").exists)
    let back = element(app, "phone-editor-back")
    let menu = element(app, "phone-editor-menu-trigger")
    XCTAssertTrue(back.isHittable)
    XCTAssertTrue(menu.isHittable)
    XCTAssertLessThan(back.frame.midX, menu.frame.midX)
    menu.tap()
    let favorite = app.buttons["Remove from Favorites"]
    XCTAssertTrue(favorite.waitForExistence(timeout: 5))
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.lifetime = .keepAlways
    add(attachment)
    favorite.tap()
    back.tap()
    XCTAssertTrue(row.waitForExistence(timeout: 5))
  }

  private func element(_ app: XCUIApplication, _ id: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: id).firstMatch
  }
}
