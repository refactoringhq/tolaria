#if DEBUG
import Foundation

func runWorkspaceFileNativeProof() throws -> [String: Bool] {
  let root = FileManager.default.temporaryDirectory.appendingPathComponent("tolaria-provider-qa-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
  defer { try? FileManager.default.removeItem(at: root) }
  let files = CoordinatedWorkspaceFile(root: root)
  let content = Data("---\ncustom: preserved\n---\n# Native provider\n".utf8)
  let revision = try files.write("note.md", data: content, expectedRevision: nil)
  let readBack = try files.read("note.md")
  let external = Data("changed in another app".utf8)
  try external.write(to: root.appendingPathComponent("note.md"), options: .atomic)
  let rejected = operationRejected { try files.write("note.md", data: content, expectedRevision: revision) }
  let afterConflict = try files.read("note.md").data
  return [
    "roundTrip": readBack.data == content && readBack.revision == revision,
    "externalEditPreserved": rejected && afterConflict == external,
    "traversalRejected": operationRejected { try files.write("../escape.md", data: content, expectedRevision: nil) },
    "gitProtected": operationRejected { try files.write(".git/config", data: content, expectedRevision: nil) },
    "bookmarkRestored": try proveWorkspaceBookmark(root),
    "invalidTextRejected": try proveInvalidWorkspaceText(root),
  ]
}

private func proveInvalidWorkspaceText(_ root: URL) throws -> Bool {
  let url = root.appendingPathComponent("invalid.md")
  let bytes = Data([0xFF, 0xFE, 0xFF])
  try bytes.write(to: url)
  defer { try? FileManager.default.removeItem(at: url) }
  let rejected = operationRejected { try WorkspaceFileIndex(root: root).read() }
  return try rejected && Data(contentsOf: url) == bytes
}

private func operationRejected<T>(_ operation: () throws -> T) -> Bool {
  do { _ = try operation(); return false } catch { return true }
}

private func proveWorkspaceBookmark(_ root: URL) throws -> Bool {
  let suite = "tolaria-provider-qa-\(UUID().uuidString)"
  guard let defaults = UserDefaults(suiteName: suite) else { return false }
  defer { defaults.removePersistentDomain(forName: suite) }
  try WorkspaceBookmarkStore(defaults: defaults).save(root)
  guard let restored = try WorkspaceBookmarkStore(defaults: defaults).restore() else { return false }
  let files = CoordinatedWorkspaceFile(root: restored)
  try files.write("restored.md", data: Data("restored".utf8), expectedRevision: nil)
  return FileManager.default.fileExists(atPath: root.appendingPathComponent("restored.md").path)
}
#endif
