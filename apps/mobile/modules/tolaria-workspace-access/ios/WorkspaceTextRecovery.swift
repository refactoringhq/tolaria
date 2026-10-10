import CryptoKit
import Foundation

enum WorkspaceTextWriteStage { case prepared, published, replaced }
enum WorkspaceTextRecoveryError: Error { case invalidRecord, checkoutPending, missingRoot }

private struct PendingWorkspaceText: Codable {
  let version: Int
  let path: String
  let before: String?
  let content: Data
}

// Indexing can run off the JS thread. Keep publication/replay exclusive with saves.
private let workspaceTextLock = NSRecursiveLock()

struct WorkspaceTextRecovery {
  let root: URL
  let journal: URL
  var afterStage: (WorkspaceTextWriteStage) throws -> Void = { _ in }

  func write(_ path: String, content: String) throws {
    workspaceTextLock.lock()
    defer { workspaceTextLock.unlock() }
    _ = try recover()
    try requireReadyRoot()
    try withDestination(path) { destination in
      let pending = PendingWorkspaceText(
        version: 1, path: path, before: try existingDigest(destination), content: Data(content.utf8)
      )
      try afterStage(.prepared)
      try FileManager.default.createDirectory(at: journal.deletingLastPathComponent(), withIntermediateDirectories: true)
      try JSONEncoder().encode(pending).write(to: journal, options: .atomic)
      try afterStage(.published)
      try replace(pending, destination: destination)
      try afterStage(.replaced)
      try FileManager.default.removeItem(at: journal)
    }
  }

  @discardableResult
  func recover() throws -> Bool {
    workspaceTextLock.lock()
    defer { workspaceTextLock.unlock() }
    guard let data = try existingData(journal) else { return false }
    let pending = try JSONDecoder().decode(PendingWorkspaceText.self, from: data)
    guard pending.version == 1 else { throw WorkspaceTextRecoveryError.invalidRecord }
    try requireReadyRoot()
    try withDestination(pending.path) { destination in
      try replace(pending, destination: destination)
      try FileManager.default.removeItem(at: journal)
    }
    return true
  }

  private func replace(_ pending: PendingWorkspaceText, destination: URL) throws {
    let current = try existingDigest(destination)
    if current == textRecoveryDigest(pending.content) { return }
    guard current == pending.before else { throw WorkspaceFileError.externalChange }
    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    _ = try workspaceFileURL(root: root, path: pending.path)
    try pending.content.write(to: destination, options: .atomic)
  }

  private func requireReadyRoot() throws {
    let values = try root.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
    guard values.isDirectory == true, values.isSymbolicLink != true else {
      throw WorkspaceTextRecoveryError.missingRoot
    }
    if FileManager.default.fileExists(atPath: root.appendingPathComponent(".git/tolaria-checkout.json").path) {
      throw WorkspaceTextRecoveryError.checkoutPending
    }
  }

  private func withDestination(_ path: String, action: @escaping (URL) throws -> Void) throws {
    let destination = try workspaceFileURL(root: root, path: path)
    var coordinationError: NSError?
    var result: Result<Void, Error>?
    NSFileCoordinator().coordinate(writingItemAt: destination, options: .forReplacing, error: &coordinationError) { url in
      result = Result {
        _ = try workspaceFileURL(root: root, path: path)
        try action(url)
      }
    }
    if let coordinationError { throw coordinationError }
    guard let result else { throw WorkspaceFileError.coordinationFailed }
    try result.get()
  }
}

func textRecoveryDigest(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

private func existingDigest(_ url: URL) throws -> String? {
  try existingData(url).map(textRecoveryDigest)
}

private func existingData(_ url: URL) throws -> Data? {
  do { return try Data(contentsOf: url) }
  catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
    return nil
  }
}
