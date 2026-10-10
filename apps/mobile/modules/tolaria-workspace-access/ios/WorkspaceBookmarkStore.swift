import Foundation

struct WorkspaceBookmarkStore {
  let defaults: UserDefaults
  private let key = "tolaria.workspace.linkedFolderBookmark"

  func save(_ root: URL) throws {
    let scoped = root.startAccessingSecurityScopedResource()
    defer { if scoped { root.stopAccessingSecurityScopedResource() } }
    try requireWorkspaceDirectory(root)
    let bookmark = try root.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
    defaults.set(bookmark, forKey: key)
  }

  func restore() throws -> URL? {
    guard let bookmark = defaults.data(forKey: key) else { return nil }
    var stale = false
    let root = try URL(resolvingBookmarkData: bookmark, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
    let scoped = root.startAccessingSecurityScopedResource()
    defer { if scoped { root.stopAccessingSecurityScopedResource() } }
    try requireWorkspaceDirectory(root)
    if stale { try save(root) }
    return root
  }
}

private func requireWorkspaceDirectory(_ root: URL) throws {
  guard root.isFileURL else { throw WorkspaceFileError.invalidPath }
  let values = try root.resourceValues(forKeys: [.isDirectoryKey])
  guard values.isDirectory == true else { throw WorkspaceFileError.invalidPath }
}
