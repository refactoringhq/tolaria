import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class WorkspaceFileSafetyTests: XCTestCase {
  func testRejectsUnsafePaths() throws {
    let root = FileManager.default.temporaryDirectory
    for path in ["", "/outside", "../outside", "a/../outside", "a//b", "a/./b", "a\\b", "bad\0name", ".git/config", ".GIT/config"] {
      XCTAssertThrowsError(try workspaceFileURL(root: root, path: path), path)
    }
  }

  func testPreservesLiteralURLCharacters() throws {
    let root = FileManager.default.temporaryDirectory
    let path = "Notes/A # & 100% ?.md"
    XCTAssertEqual(try workspaceFileURL(root: root, path: path).path, root.appendingPathComponent(path).path)
  }

  func testRejectsSymlinkParentsAndLeaves() throws {
    try withDisposableWorkspace { root in
      let target = root.appendingPathComponent("target")
      try FileManager.default.createDirectory(at: target, withIntermediateDirectories: false)
      try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("link"), withDestinationURL: target)
      XCTAssertThrowsError(try workspaceFileURL(root: root, path: "link/note.md"))
      XCTAssertThrowsError(try workspaceFileURL(root: root, path: "link"))
    }
  }
}

func withDisposableWorkspace(_ operation: (URL) throws -> Void) throws {
  let root = FileManager.default.temporaryDirectory.appendingPathComponent("tolaria-file-test-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
  defer { try? FileManager.default.removeItem(at: root) }
  try operation(root)
}
