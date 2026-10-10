import CryptoKit
import Foundation

struct WorkspaceFileSnapshot {
  let data: Data
  let revision: String
}

/// A caller must obtain the root from a document picker or a restored bookmark.
struct CoordinatedWorkspaceFile {
  let root: URL

  func read(_ path: String) throws -> WorkspaceFileSnapshot {
    try withWorkspaceAccess {
      let url = try workspaceFileURL(root: root, path: path)
      return try coordinated(url, writing: false) { coordinatedURL in
        _ = try workspaceFileURL(root: root, path: path)
        let data = try Data(contentsOf: coordinatedURL)
        return WorkspaceFileSnapshot(data: data, revision: workspaceFileRevision(data))
      }
    }
  }

  /// nil means "create only"; an existing file always requires its last read revision.
  @discardableResult
  func write(_ path: String, data: Data, expectedRevision: String?) throws -> String {
    try withWorkspaceAccess {
      let url = try workspaceFileURL(root: root, path: path)
      return try coordinated(url, writing: true) { coordinatedURL in
        _ = try workspaceFileURL(root: root, path: path)
        try requireWorkspaceRevision(coordinatedURL, expected: expectedRevision)
        try data.write(to: coordinatedURL, options: .atomic)
        return workspaceFileRevision(data)
      }
    }
  }

  private func withWorkspaceAccess<T>(_ operation: () throws -> T) throws -> T {
    let scoped = root.startAccessingSecurityScopedResource()
    defer { if scoped { root.stopAccessingSecurityScopedResource() } }
    return try operation()
  }
}

private func requireWorkspaceRevision(_ url: URL, expected: String?) throws {
  let current = try existingWorkspaceRevision(url)
  guard current == expected else { throw WorkspaceFileError.externalChange }
}

private func existingWorkspaceRevision(_ url: URL) throws -> String? {
  do {
    return workspaceFileRevision(try Data(contentsOf: url))
  } catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
    return nil
  }
}

private func workspaceFileRevision(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

private func coordinated<T>(_ url: URL, writing: Bool, operation: @escaping (URL) throws -> T) throws -> T {
  var error: NSError?
  var result: Result<T, Error>?
  let accessor: (URL) -> Void = { coordinatedURL in
    result = Result { try operation(coordinatedURL) }
  }
  let coordinator = NSFileCoordinator()
  if writing {
    coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &error, byAccessor: accessor)
  } else {
    coordinator.coordinate(readingItemAt: url, options: [], error: &error, byAccessor: accessor)
  }
  if let error { throw error }
  guard let result else { throw WorkspaceFileError.coordinationFailed }
  return try result.get()
}
