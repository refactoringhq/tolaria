import Foundation

enum WorkspaceFileError: Error {
  case invalidPath
  case reservedPath
  case symbolicLink
  case externalChange
  case coordinationFailed
}

func workspaceFileURL(root: URL, path: String) throws -> URL {
  guard !path.isEmpty, !path.hasPrefix("/"), !path.contains("\\"), !path.contains("\0") else {
    throw WorkspaceFileError.invalidPath
  }
  let parts = path.split(separator: "/", omittingEmptySubsequences: false)
  var result = root.standardizedFileURL
  for part in parts {
    try validateWorkspacePathPart(String(part))
    result.appendPathComponent(String(part))
    try rejectWorkspaceSymlink(result)
  }
  return result
}

private func validateWorkspacePathPart(_ part: String) throws {
  guard !part.isEmpty, part != ".", part != ".." else { throw WorkspaceFileError.invalidPath }
  guard part.lowercased() != ".git" else { throw WorkspaceFileError.reservedPath }
}

private func rejectWorkspaceSymlink(_ url: URL) throws {
  let attributes: [FileAttributeKey: Any]
  do {
    attributes = try FileManager.default.attributesOfItem(atPath: url.path)
  } catch let error as NSError where error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
    return
  }
  if attributes[.type] as? FileAttributeType == .typeSymbolicLink {
    throw WorkspaceFileError.symbolicLink
  }
}
