// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "TolariaWorkspaceFiles",
  platforms: [.macOS(.v13), .iOS(.v15)],
  targets: [
    .target(
      name: "TolariaWorkspaceFiles",
      path: "ios",
      exclude: ["TolariaWorkspaceAccessModule.swift", "TolariaWorkspaceAccess.podspec"],
      sources: ["WorkspaceFileSafety.swift", "CoordinatedWorkspaceFile.swift", "WorkspaceBookmarkStore.swift", "WorkspaceFileNativeProof.swift", "WorkspaceFileIndex.swift", "ManagedWorkspaceImport.swift"]
    ),
    .testTarget(name: "TolariaWorkspaceFilesTests", dependencies: ["TolariaWorkspaceFiles"], path: "tests"),
  ]
)
