import Foundation

/// The destination is app-owned. Validation must finish before replacing its current copy.
func importManagedWorkspace(from source: URL, to managed: URL) throws -> String {
  if source.standardizedFileURL == managed.standardizedFileURL {
    return try WorkspaceFileIndex(root: managed).json()
  }
  let sourcePrefix = source.standardizedFileURL.path + "/"
  guard !managed.standardizedFileURL.path.hasPrefix(sourcePrefix) else { throw WorkspaceFileError.invalidPath }
  let staging = managed.deletingLastPathComponent()
    .appendingPathComponent(".tolaria-import-\(UUID().uuidString)", isDirectory: true)
  defer { try? FileManager.default.removeItem(at: staging) }
  try FileManager.default.copyItem(at: source, to: staging)
  let indexJson = try WorkspaceFileIndex(root: staging, publishedRoot: managed).json()
  try replaceManagedWorkspace(at: managed, with: staging)
  return indexJson
}

private func replaceManagedWorkspace(at managed: URL, with staging: URL) throws {
  let fileManager = FileManager.default
  let backup = managed.deletingLastPathComponent()
    .appendingPathComponent(".tolaria-backup-\(UUID().uuidString)", isDirectory: true)
  let hadManagedWorkspace = fileManager.fileExists(atPath: managed.path)
  if hadManagedWorkspace { try fileManager.moveItem(at: managed, to: backup) }
  do {
    try fileManager.moveItem(at: staging, to: managed)
    if hadManagedWorkspace { try? fileManager.removeItem(at: backup) }
  } catch {
    if hadManagedWorkspace { try? fileManager.moveItem(at: backup, to: managed) }
    throw error
  }
}
