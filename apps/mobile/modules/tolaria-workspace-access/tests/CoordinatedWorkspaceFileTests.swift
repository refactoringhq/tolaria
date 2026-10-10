import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class CoordinatedWorkspaceFileTests: XCTestCase {
  func testCreatesAndUpdatesTheOriginalFile() throws {
    try withDisposableWorkspace { root in
      let files = CoordinatedWorkspaceFile(root: root)
      let first = Data("---\ncustom: retained\n---\n# Original\n".utf8)
      let revision = try files.write("note.md", data: first, expectedRevision: nil)
      let read = try files.read("note.md")
      XCTAssertEqual(read.data, first)
      XCTAssertEqual(read.revision, revision)
      let changed = Data("---\ncustom: retained\n---\n# Updated\n".utf8)
      try files.write("note.md", data: changed, expectedRevision: revision)
      XCTAssertEqual(try Data(contentsOf: root.appendingPathComponent("note.md")), changed)
      XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), ["note.md"])
    }
  }

  func testRefusesToOverwriteAnExternalEdit() throws {
    try withDisposableWorkspace { root in
      let files = CoordinatedWorkspaceFile(root: root)
      let revision = try files.write("note.md", data: Data("initial".utf8), expectedRevision: nil)
      let external = Data("changed elsewhere".utf8)
      try external.write(to: root.appendingPathComponent("note.md"), options: .atomic)
      XCTAssertThrowsError(try files.write("note.md", data: Data("local draft".utf8), expectedRevision: revision))
      XCTAssertEqual(try files.read("note.md").data, external)
    }
  }

  func testCreateDoesNotReplaceExistingFilesAndDeleteDoesNotResurrectThem() throws {
    try withDisposableWorkspace { root in
      let files = CoordinatedWorkspaceFile(root: root)
      let revision = try files.write("note.md", data: Data("initial".utf8), expectedRevision: nil)
      XCTAssertThrowsError(try files.write("note.md", data: Data(), expectedRevision: nil))
      try FileManager.default.removeItem(at: root.appendingPathComponent("note.md"))
      XCTAssertThrowsError(try files.write("note.md", data: Data(), expectedRevision: revision))
      XCTAssertFalse(FileManager.default.fileExists(atPath: root.appendingPathComponent("note.md").path))
    }
  }

  func testBinaryBytesAndUnicodeNamesRoundTrip() throws {
    try withDisposableWorkspace { root in
      let files = CoordinatedWorkspaceFile(root: root)
      let bytes = Data([0, 255, 128, 42, 0, 10])
      try files.write("100% # ? \u{00e9}.bin", data: bytes, expectedRevision: nil)
      XCTAssertEqual(try files.read("100% # ? \u{00e9}.bin").data, bytes)
    }
  }
}
