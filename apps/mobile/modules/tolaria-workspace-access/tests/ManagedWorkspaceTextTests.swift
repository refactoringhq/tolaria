import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class ManagedWorkspaceTextTests: XCTestCase {
  func testJournalIsPrivateAndIdentitySurvivesAContainerMove() throws {
    let firstHome = URL(fileURLWithPath: "/tmp/container-before")
    let nextHome = URL(fileURLWithPath: "/tmp/container-after")
    let first = try managedWorkspaceText(firstHome.appendingPathComponent("Documents/Vault").absoluteString, home: firstHome)
    let next = try managedWorkspaceText(nextHome.appendingPathComponent("Documents/Vault").absoluteString, home: nextHome)
    XCTAssertEqual(first.journal.lastPathComponent, next.journal.lastPathComponent)
    XCTAssertFalse(first.journal.path.hasPrefix(first.root.path + "/"))
    XCTAssertTrue(first.journal.path.contains("Library/Application Support/"))
    let another = try managedWorkspaceText(firstHome.appendingPathComponent("Documents/Other").absoluteString, home: firstHome)
    XCTAssertNotEqual(first.journal.lastPathComponent, another.journal.lastPathComponent)
  }

  func testRejectsOriginalProviderFoldersAndEscapes() throws {
    let home = URL(fileURLWithPath: "/tmp/recovery-sandbox")
    let paths = ["file:///tmp/outside", "file:///tmp/recovery-sandbox/Library/Other", "https://example.invalid/vault"]
    for path in paths { XCTAssertThrowsError(try managedWorkspaceText(path, home: home)) }
    XCTAssertThrowsError(try managedWorkspaceText(home.appendingPathComponent("Documents/../../outside").absoluteString, home: home))
  }

  func testRejectsSymlinkedRoots() throws {
    try withTextRecoveryFixture { root, _ in
      let home = root.deletingLastPathComponent()
      let documents = home.appendingPathComponent("Documents")
      try FileManager.default.createDirectory(at: documents, withIntermediateDirectories: true)
      let link = documents.appendingPathComponent("Linked")
      try FileManager.default.createSymbolicLink(at: link, withDestinationURL: root)
      XCTAssertThrowsError(try managedWorkspaceText(link.absoluteString, home: home))
    }
  }
}
