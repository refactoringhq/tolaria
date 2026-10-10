import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class WorkspaceFileIndexTests: XCTestCase {
  func testInvalidTextFailsInsteadOfBecomingAnEmptyNote() throws {
    try withDisposableWorkspace { root in
      let note = root.appendingPathComponent("note.md")
      let bytes = Data([0xFF, 0xFE, 0xFF])
      try bytes.write(to: note)
      XCTAssertThrowsError(try WorkspaceFileIndex(root: root).read())
      XCTAssertEqual(try Data(contentsOf: note), bytes)
    }
  }

  func testVisibleSymlinksAreRejected() throws {
    try withDisposableWorkspace { root in
      let target = root.appendingPathComponent("target.md")
      try Data("target".utf8).write(to: target)
      try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("link.md"), withDestinationURL: target)
      XCTAssertThrowsError(try WorkspaceFileIndex(root: root).read())
    }
  }

  func testMissingRootDoesNotReturnAnEmptyVault() throws {
    try withDisposableWorkspace { root in
      XCTAssertThrowsError(try WorkspaceFileIndex(root: root.appendingPathComponent("missing")).read())
    }
  }

  func testPreservesEmptyNotesAndBinaryEntries() throws {
    try withDisposableWorkspace { root in
      try Data().write(to: root.appendingPathComponent("empty.md"))
      try Data([255, 0, 128]).write(to: root.appendingPathComponent("image.png"))
      let index = try WorkspaceFileIndex(root: root).read()
      let files = try XCTUnwrap(index["files"] as? [[String: Any]])
      XCTAssertEqual(files.count, 2)
      XCTAssertTrue(files.allSatisfy { $0["content"] as? String == "" })
      XCTAssertEqual(files.first { $0["relativePath"] as? String == "image.png" }?["size"] as? Int, 3)
    }
  }

  func testStagingIndexPublishesFinalPathsAndSkipsInternalDirectories() throws {
    try withDisposableWorkspace { root in
      for path in ["Notes", ".git", "node_modules"] {
        let directory = root.appendingPathComponent(path)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        try Data("# Note".utf8).write(to: directory.appendingPathComponent("a # %.md"))
      }
      let published = root.deletingLastPathComponent().appendingPathComponent("published")
      let json = try WorkspaceFileIndex(root: root, publishedRoot: published).json()
      let index = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
      XCTAssertEqual(index["directories"] as? [String], ["Notes"])
      let files = try XCTUnwrap(index["files"] as? [[String: Any]])
      XCTAssertEqual(files.count, 1)
      XCTAssertEqual(files.first?["content"] as? String, "# Note")
      XCTAssertEqual(files.first?["absolutePath"] as? String, published.appendingPathComponent("Notes/a # %.md").absoluteString)
    }
  }
}
