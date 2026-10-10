import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class WorkspaceTextRecoveryTests: XCTestCase {
  func testRecoversPublishedSaveWithNoInMemoryState() throws {
    try withTextRecoveryFixture { root, journal in
      let destination = root.appendingPathComponent("note.md")
      try Data("before".utf8).write(to: destination)
      let content = "---\ncustom: retained\n---\n# After\n"
      let interrupted = WorkspaceTextRecovery(root: root, journal: journal, afterStage: { stage in
        if stage == .published { throw RecoveryTestFailure.interrupted }
      })
      XCTAssertThrowsError(try interrupted.write("note.md", content: content))
      XCTAssertEqual(try String(contentsOf: destination), "before")
      let restarted = WorkspaceTextRecovery(root: root, journal: journal)
      XCTAssertTrue(try restarted.recover())
      XCTAssertEqual(try String(contentsOf: destination), content)
      XCTAssertFalse(try restarted.recover())
      XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), ["note.md"])
    }
  }

  func testAcceptsAlreadyReplacedFileWithoutOverwritingItAgain() throws {
    try withTextRecoveryFixture { root, journal in
      let interrupted = WorkspaceTextRecovery(root: root, journal: journal, afterStage: { stage in
        if stage == .replaced { throw RecoveryTestFailure.interrupted }
      })
      XCTAssertThrowsError(try interrupted.write("nested/new.md", content: "new"))
      let destination = root.appendingPathComponent("nested/new.md")
      let before = try destination.resourceValues(forKeys: [.contentModificationDateKey])
      XCTAssertTrue(try WorkspaceTextRecovery(root: root, journal: journal).recover())
      let after = try destination.resourceValues(forKeys: [.contentModificationDateKey])
      XCTAssertEqual(before.contentModificationDate, after.contentModificationDate)
      XCTAssertEqual(try String(contentsOf: destination), "new")
    }
  }

  func testExternalEditOrDeletionKeepsBothVersionsAndBlocksLaterSave() throws {
    try withTextRecoveryFixture { root, journal in
      let destination = root.appendingPathComponent("note.md")
      try Data("original".utf8).write(to: destination)
      let interrupted = WorkspaceTextRecovery(root: root, journal: journal, afterStage: { stage in
        if stage == .published { throw RecoveryTestFailure.interrupted }
      })
      XCTAssertThrowsError(try interrupted.write("note.md", content: "local draft"))
      try Data("external edit".utf8).write(to: destination, options: .atomic)
      let pending = try Data(contentsOf: journal)
      let restarted = WorkspaceTextRecovery(root: root, journal: journal)
      XCTAssertThrowsError(try restarted.recover())
      XCTAssertThrowsError(try restarted.write("another.md", content: "later"))
      XCTAssertEqual(try String(contentsOf: destination), "external edit")
      XCTAssertEqual(try Data(contentsOf: journal), pending)
      try FileManager.default.removeItem(at: destination)
      XCTAssertThrowsError(try restarted.recover())
      XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
      XCTAssertEqual(try Data(contentsOf: journal), pending)
    }
  }

  func testFailureBeforePublishingDoesNotChangeOriginal() throws {
    try withTextRecoveryFixture { root, journal in
      let destination = root.appendingPathComponent("note.md")
      try Data("original".utf8).write(to: destination)
      let interrupted = WorkspaceTextRecovery(root: root, journal: journal, afterStage: { stage in
        if stage == .prepared { throw RecoveryTestFailure.interrupted }
      })
      XCTAssertThrowsError(try interrupted.write("note.md", content: "draft"))
      XCTAssertEqual(try String(contentsOf: destination), "original")
      XCTAssertFalse(try WorkspaceTextRecovery(root: root, journal: journal).recover())
    }
  }

  func testCorruptRecordAndUnsafePathsFailClosed() throws {
    try withTextRecoveryFixture { root, journal in
      let writer = WorkspaceTextRecovery(root: root, journal: journal)
      for path in ["../escape.md", ".git/config", "nested/../escape.md"] {
        XCTAssertThrowsError(try writer.write(path, content: "unsafe"))
      }
      try Data("incomplete JSON".utf8).write(to: journal)
      XCTAssertThrowsError(try writer.recover())
      XCTAssertThrowsError(try writer.write("note.md", content: "draft"))
      XCTAssertEqual(try String(contentsOf: journal), "incomplete JSON")
      XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: root.path).isEmpty)
    }
  }
}

enum RecoveryTestFailure: Error { case interrupted }

func withTextRecoveryFixture(_ test: (URL, URL) throws -> Void) throws {
  let base = FileManager.default.temporaryDirectory.appendingPathComponent("tolaria-save-test-\(UUID().uuidString)")
  let root = base.appendingPathComponent("vault")
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: base) }
  try test(root, base.appendingPathComponent("pending.json"))
}
