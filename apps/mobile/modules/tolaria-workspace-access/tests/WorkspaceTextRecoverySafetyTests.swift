import Foundation
import XCTest
@testable import TolariaWorkspaceFiles

final class WorkspaceTextRecoverySafetyTests: XCTestCase {
  func testAnUnwritableJournalDoesNotTouchTheNote() throws {
    try withTextRecoveryFixture { root, journal in
      try Data("before".utf8).write(to: root.appendingPathComponent("note.md"))
      try FileManager.default.createDirectory(at: journal, withIntermediateDirectories: false)
      XCTAssertThrowsError(try WorkspaceTextRecovery(root: root, journal: journal).write("note.md", content: "after"))
      XCTAssertEqual(try String(contentsOf: root.appendingPathComponent("note.md")), "before")
    }
  }

  func testLaterSaveReplaysEarlierIntentFirstAndLeavesNewestContent() throws {
    try withTextRecoveryFixture { root, journal in
      let interrupted = WorkspaceTextRecovery(root: root, journal: journal, afterStage: { stage in
        if stage == .published { throw RecoveryTestFailure.interrupted }
      })
      XCTAssertThrowsError(try interrupted.write("note.md", content: "older"))
      try WorkspaceTextRecovery(root: root, journal: journal).write("note.md", content: "newest")
      XCTAssertEqual(try String(contentsOf: root.appendingPathComponent("note.md")), "newest")
      XCTAssertFalse(FileManager.default.fileExists(atPath: journal.path))
    }
  }

  func testReplayCannotCrossSymlinksOrGitCheckout() throws {
    try withTextRecoveryFixture { root, journal in
      let interrupted = WorkspaceTextRecovery(root: root, journal: journal, afterStage: { stage in
        if stage == .published { throw RecoveryTestFailure.interrupted }
      })
      XCTAssertThrowsError(try interrupted.write("nested/note.md", content: "pending"))
      let outside = root.deletingLastPathComponent().appendingPathComponent("outside")
      try FileManager.default.createDirectory(at: outside, withIntermediateDirectories: false)
      let nested = root.appendingPathComponent("nested")
      try FileManager.default.createSymbolicLink(at: nested, withDestinationURL: outside)
      let restarted = WorkspaceTextRecovery(root: root, journal: journal)
      XCTAssertThrowsError(try restarted.recover())
      XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: outside.path).isEmpty)
      try FileManager.default.removeItem(at: nested)
      let git = root.appendingPathComponent(".git")
      try FileManager.default.createDirectory(at: git, withIntermediateDirectories: false)
      try Data("{}".utf8).write(to: git.appendingPathComponent("tolaria-checkout.json"))
      XCTAssertThrowsError(try restarted.recover())
      XCTAssertTrue(FileManager.default.fileExists(atPath: journal.path))
    }
  }

  func testMalformedOrNewerRecordNeverCreatesAnEscapedFile() throws {
    try withTextRecoveryFixture { root, journal in
      let records: [[String: Any]] = [
        ["version": 99, "path": "note.md", "content": Data("draft".utf8).base64EncodedString()],
        ["version": 1, "path": "../escape.md", "content": Data("draft".utf8).base64EncodedString()],
        ["version": 1, "path": "note.md", "content": "invalid base64"],
      ]
      for record in records {
        let data = try JSONSerialization.data(withJSONObject: record)
        try data.write(to: journal, options: .atomic)
        XCTAssertThrowsError(try WorkspaceTextRecovery(root: root, journal: journal).recover())
        XCTAssertEqual(try Data(contentsOf: journal), data)
      }
      XCTAssertFalse(FileManager.default.fileExists(atPath: root.deletingLastPathComponent().appendingPathComponent("escape.md").path))
      XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: root.path).isEmpty)
    }
  }
}
