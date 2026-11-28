use super::{get_conflict_files, git_resolve_conflict, run_git};
use crate::git::{git_commit, tests::setup_git_repo};
use std::fs;

#[test]
fn test_resolve_conflict_preserves_unstaged_edits_to_nonconflicted_file() {
    let dir = setup_git_repo();
    let vault = dir.path();
    let note = vault.join("note.md");
    fs::write(&note, "initial\n").unwrap();
    git_commit(vault.to_str().unwrap(), "initial").unwrap();
    fs::write(&note, "local edit\n").unwrap();

    let result = git_resolve_conflict(vault, "note.md", "ours");

    assert!(result.is_err());
    assert_eq!(fs::read_to_string(note).unwrap(), "local edit\n");
}

#[test]
fn test_resolve_conflict_treats_git_metacharacters_as_literal() {
    let dir = setup_git_repo();
    let vault = dir.path();
    let vp = vault.to_str().unwrap();
    let conflict = vault.join("note[1].md");
    let unrelated = vault.join("note1.md");
    fs::write(&conflict, "base\n").unwrap();
    fs::write(&unrelated, "base\n").unwrap();
    git_commit(vp, "initial").unwrap();

    run_git(vault, &["checkout", "-b", "feature"]).unwrap();
    fs::write(&conflict, "theirs\n").unwrap();
    git_commit(vp, "feature edit").unwrap();
    run_git(vault, &["checkout", "main"]).unwrap();
    fs::write(&conflict, "ours\n").unwrap();
    git_commit(vp, "main edit").unwrap();
    assert!(run_git(vault, &["merge", "feature"]).is_err());
    assert_eq!(get_conflict_files(vault).unwrap(), vec!["note[1].md"]);
    fs::write(&unrelated, "local edit\n").unwrap();

    git_resolve_conflict(vault, "note[1].md", "ours").unwrap();

    assert_eq!(fs::read_to_string(conflict).unwrap(), "ours\n");
    assert_eq!(fs::read_to_string(unrelated).unwrap(), "local edit\n");
    assert!(get_conflict_files(vault).unwrap().is_empty());
}
