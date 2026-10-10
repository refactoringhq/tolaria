import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class ManagedWorkspaceImportTests: XCTestCase {
  func testInvalidImportPreservesPreviousVaultAndRemovesStaging() throws {
    try withImportDirectories { source, managed in
      let original = managed.appendingPathComponent("original.md")
      try Data("previous vault".utf8).write(to: original)
      try Data([255, 254, 255]).write(to: source.appendingPathComponent("invalid.md"))
      XCTAssertThrowsError(try importManagedWorkspace(from: source, to: managed))
      XCTAssertEqual(try String(contentsOf: original, encoding: .utf8), "previous vault")
      XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: managed.path), ["original.md"])
      XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: managed.deletingLastPathComponent().path).sorted(), ["managed", "source"])
    }
  }

  func testSuccessfulImportPublishesManagedPathsWithoutChangingSource() throws {
    try withImportDirectories { source, managed in
      let note = source.appendingPathComponent("note.md")
      try Data("# Original".utf8).write(to: note)
      try Data("old".utf8).write(to: managed.appendingPathComponent("old.md"))
      let json = try importManagedWorkspace(from: source, to: managed)
      let index = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
      let files = try XCTUnwrap(index["files"] as? [[String: Any]])
      XCTAssertEqual(files.first?["absolutePath"] as? String, managed.appendingPathComponent("note.md").absoluteString)
      XCTAssertEqual(try String(contentsOf: note, encoding: .utf8), "# Original")
      XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: managed.path), ["note.md"])
      let restoredJson = try importManagedWorkspace(from: managed, to: managed)
      let restored = try JSONSerialization.jsonObject(with: Data(restoredJson.utf8)) as? NSDictionary
      XCTAssertEqual(restored, index as NSDictionary)
    }
  }

  func testRejectsCopyingAParentFolderIntoItself() throws {
    try withImportDirectories { source, _ in
      XCTAssertThrowsError(try importManagedWorkspace(from: source, to: source.appendingPathComponent("child")))
      XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: source.path), [])
    }
  }
}

private func withImportDirectories(_ operation: (URL, URL) throws -> Void) throws {
  try withDisposableWorkspace { root in
    let source = root.appendingPathComponent("source")
    let managed = root.appendingPathComponent("managed")
    try FileManager.default.createDirectory(at: source, withIntermediateDirectories: false)
    try FileManager.default.createDirectory(at: managed, withIntermediateDirectories: false)
    try operation(source, managed)
  }
}
