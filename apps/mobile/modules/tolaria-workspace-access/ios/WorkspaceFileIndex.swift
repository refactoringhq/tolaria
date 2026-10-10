import Foundation

struct WorkspaceFileIndex {
  let root: URL
  let publishedRoot: URL

  init(root: URL, publishedRoot: URL? = nil) {
    self.root = root
    self.publishedRoot = publishedRoot ?? root
  }

  func json() throws -> String {
    let index = try read()
    let data = try JSONSerialization.data(withJSONObject: index)
    return String(decoding: data, as: UTF8.self)
  }

  func read() throws -> [String: Any] {
    var enumerationError: Error?
    guard let enumerator = FileManager.default.enumerator(
      at: root,
      includingPropertiesForKeys: Array(workspaceIndexKeys),
      options: [.skipsHiddenFiles, .skipsPackageDescendants],
      errorHandler: { _, error in enumerationError = error; return false }
    ) else { throw CocoaError(.fileReadUnknown) }
    var directories: [String] = []
    var files: [[String: Any]] = []
    for case let url as URL in enumerator {
      try appendEntry(url, enumerator: enumerator, directories: &directories, files: &files)
    }
    if let enumerationError { throw enumerationError }
    return ["directories": directories, "files": files]
  }

  private func appendEntry(
    _ url: URL, enumerator: FileManager.DirectoryEnumerator,
    directories: inout [String], files: inout [[String: Any]]
  ) throws {
    let values = try url.resourceValues(forKeys: workspaceIndexKeys)
    if values.isSymbolicLink == true { throw WorkspaceFileError.symbolicLink }
    let path = try relativePath(url)
    if values.isDirectory == true {
      if url.lastPathComponent == "node_modules" { enumerator.skipDescendants(); return }
      directories.append(path)
      return
    }
    if values.isRegularFile == true { files.append(try fileRecord(url, path: path, values: values)) }
  }

  private func fileRecord(_ url: URL, path: String, values: URLResourceValues) throws -> [String: Any] {
    let content = try textContent(url)
    return [
      "absolutePath": publishedRoot.appendingPathComponent(path).absoluteString,
      "content": content,
      "createdAt": milliseconds(values.creationDate),
      "modifiedAt": milliseconds(values.contentModificationDate),
      "relativePath": path,
      "size": values.fileSize ?? content.utf8.count,
    ]
  }

  private func textContent(_ url: URL) throws -> String {
    guard workspaceTextExtensions.contains(url.pathExtension.lowercased())
      || workspaceTextFileNames.contains(url.lastPathComponent.lowercased()) else { return "" }
    return try String(contentsOf: url, encoding: .utf8)
  }

  private func relativePath(_ url: URL) throws -> String {
    let prefix = root.standardizedFileURL.path + "/"
    let path = url.standardizedFileURL.path
    guard path.hasPrefix(prefix) else { throw WorkspaceFileError.invalidPath }
    return String(path.dropFirst(prefix.count))
  }
}

private func milliseconds(_ date: Date?) -> Any {
  date.map { $0.timeIntervalSince1970 * 1000 } ?? NSNull()
}

private let workspaceIndexKeys: Set<URLResourceKey> = [
  .contentModificationDateKey, .creationDateKey, .fileSizeKey,
  .isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey,
]

private let workspaceTextExtensions: Set<String> = [
  "bash", "bat", "c", "cfg", "clj", "cmd", "conf", "cpp", "css", "csv", "el", "erl",
  "ex", "exs", "fish", "go", "graphql", "h", "hcl", "hpp", "hs", "htm", "html", "ini",
  "java", "jl", "js", "json", "jsx", "kt", "less", "lisp", "lua", "md", "markdown", "mdx",
  "ml", "nix", "properties", "ps1", "py", "r", "rb", "rs", "scss", "sh", "sql", "svelte",
  "swift", "tf", "toml", "ts", "tsx", "txt", "vim", "vue", "xml", "yaml", "yml", "zig", "zsh",
]

private let workspaceTextFileNames: Set<String> = [
  ".editorconfig", ".env", ".gitignore", "brewfile", "dockerfile", "makefile",
]
