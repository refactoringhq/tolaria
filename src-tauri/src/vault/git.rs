use std::path::Path;

/// Run a git command in the given directory and return stdout if successful.
pub(crate) fn run_git(vault: &Path, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(vault)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get the current HEAD commit hash.
pub(crate) fn git_head_hash(vault: &Path) -> Option<String> {
    run_git(vault, &["rev-parse", "HEAD"]).map(|s| s.trim().to_string())
}

/// Parse a git status porcelain line into (status_code, file_path).
fn parse_porcelain_line(line: &str) -> Option<(&str, String)> {
    if line.len() < 3 { return None; }
    Some((&line[..2], line[3..].trim().to_string()))
}

/// Check if a porcelain status indicates a new/untracked file.
fn is_new_file_status(status: &str) -> bool {
    status == "??" || status.starts_with('A')
}

/// Extract .md file paths from git diff --name-only output.
fn collect_md_paths_from_diff(stdout: &str) -> Vec<String> {
    stdout.lines()
        .filter(|line| !line.is_empty() && line.ends_with(".md"))
        .map(|line| line.to_string())
        .collect()
}

/// Extract .md file paths from git status --porcelain output.
fn collect_md_paths_from_porcelain(stdout: &str) -> Vec<String> {
    stdout.lines()
        .filter_map(parse_porcelain_line)
        .filter(|(_, path)| path.ends_with(".md"))
        .map(|(_, path)| path)
        .collect()
}

/// Get list of .md files changed between two commits plus uncommitted changes.
pub(crate) fn git_changed_files(vault: &Path, from_hash: &str, to_hash: &str) -> Vec<String> {
    let diff_arg = format!("{}..{}", from_hash, to_hash);
    let mut files = run_git(vault, &["diff", &diff_arg, "--name-only"])
        .map(|s| collect_md_paths_from_diff(&s))
        .unwrap_or_default();

    let uncommitted = run_git(vault, &["status", "--porcelain"])
        .map(|s| collect_md_paths_from_porcelain(&s))
        .unwrap_or_default();

    for path in uncommitted {
        if !files.contains(&path) {
            files.push(path);
        }
    }

    files
}

/// Get list of uncommitted new .md files (untracked or staged-added).
pub(crate) fn git_uncommitted_new_files(vault: &Path) -> Vec<String> {
    let stdout = match run_git(vault, &["status", "--porcelain"]) {
        Some(s) => s,
        None => return Vec::new(),
    };
    stdout.lines()
        .filter_map(parse_porcelain_line)
        .filter(|(status, path)| path.ends_with(".md") && is_new_file_status(status))
        .map(|(_, path)| path)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_porcelain_line_valid() {
        let (status, path) = parse_porcelain_line("?? new-file.md").unwrap();
        assert_eq!(status, "??");
        assert_eq!(path, "new-file.md");
    }

    #[test]
    fn test_parse_porcelain_line_too_short() {
        assert!(parse_porcelain_line("??").is_none());
    }

    #[test]
    fn test_is_new_file_status() {
        assert!(is_new_file_status("??"));
        assert!(is_new_file_status("A "));
        assert!(!is_new_file_status("M "));
        assert!(!is_new_file_status(" M"));
    }

    #[test]
    fn test_collect_md_paths_from_diff() {
        let stdout = "file.md\nother.txt\nsub/note.md\n";
        let paths = collect_md_paths_from_diff(stdout);
        assert_eq!(paths, vec!["file.md", "sub/note.md"]);
    }

    #[test]
    fn test_collect_md_paths_from_porcelain() {
        let stdout = "?? new.md\n M changed.txt\nA  added.md\n";
        let paths = collect_md_paths_from_porcelain(stdout);
        assert_eq!(paths, vec!["new.md", "added.md"]);
    }
}
