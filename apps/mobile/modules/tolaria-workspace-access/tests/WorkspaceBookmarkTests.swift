import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class WorkspaceBookmarkTests: XCTestCase {
  func testRestoresTheOriginalDirectoryAcrossInstances() throws {
    try withDisposableWorkspace { root in
      let suite = "tolaria-bookmark-test-\(UUID().uuidString)"
      let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
      defer { defaults.removePersistentDomain(forName: suite) }
      let store = WorkspaceBookmarkStore(defaults: defaults)
      XCTAssertNil(try store.restore())
      try store.save(root)
      let restored = try XCTUnwrap(WorkspaceBookmarkStore(defaults: defaults).restore())
      XCTAssertEqual(restored.resolvingSymlinksInPath(), root.resolvingSymlinksInPath())
      let files = CoordinatedWorkspaceFile(root: restored)
      try files.write("restored.md", data: Data("original folder".utf8), expectedRevision: nil)
      XCTAssertTrue(FileManager.default.fileExists(atPath: root.appendingPathComponent("restored.md").path))
    }
  }

  func testRejectsFilesWithoutReplacingTheLastFolderGrant() throws {
    try withDisposableWorkspace { root in
      let suite = "tolaria-bookmark-test-\(UUID().uuidString)"
      let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
      defer { defaults.removePersistentDomain(forName: suite) }
      let store = WorkspaceBookmarkStore(defaults: defaults)
      try store.save(root)
      let file = root.appendingPathComponent("note.md")
      try Data().write(to: file)
      XCTAssertThrowsError(try store.save(file))
      XCTAssertEqual(try store.restore()?.resolvingSymlinksInPath(), root.resolvingSymlinksInPath())
    }
  }
}
