import Foundation

func managedWorkspaceText(_ uri: String, home: URL = URL(fileURLWithPath: NSHomeDirectory())) throws -> WorkspaceTextRecovery {
  guard let root = URL(string: uri), root.isFileURL else { throw WorkspaceFileError.invalidPath }
  let prefix = home.standardizedFileURL.path + "/"
  let path = root.standardizedFileURL.path
  guard path.hasPrefix(prefix) else { throw WorkspaceFileError.invalidPath }
  let relative = String(path.dropFirst(prefix.count))
  guard relative.hasPrefix("Documents/") || relative.hasPrefix("Library/Caches/") || relative.hasPrefix("tmp/") else {
    throw WorkspaceFileError.invalidPath
  }
  let validatedRoot = try workspaceFileURL(root: home, path: relative)
  // A container's UUID changes after installation; the home-relative identity does not.
  let key = textRecoveryDigest(Data(relative.utf8))
  let journal = home.appendingPathComponent("Library/Application Support/TolariaWorkspaceWrites/\(key).json")
  return WorkspaceTextRecovery(root: validatedRoot, journal: journal)
}
