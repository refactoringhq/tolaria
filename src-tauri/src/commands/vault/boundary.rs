use crate::commands::expand_tilde;
use crate::vault::filename_rules::validate_view_filename_stem;
use crate::vault_list;
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

pub(crate) const ACTIVE_VAULT_PATH_ERROR: &str = "Path must stay inside the active vault";
const ACTIVE_VAULT_MISMATCH_ERROR: &str = "Vault path must match the active vault";
const ACTIVE_VAULT_UNAVAILABLE_ERROR: &str = "Active vault is not available";
const NO_ACTIVE_VAULT_ERROR: &str = "No active vault selected";
pub(crate) const INVALID_VIEW_FILENAME_ERROR: &str = "Invalid view filename";

#[derive(Clone, Debug)]
struct VaultRootPaths {
    requested: PathBuf,
    canonical: PathBuf,
}

#[derive(Clone, Debug)]
pub(crate) struct VaultBoundary {
    requested_root: PathBuf,
    canonical_root: PathBuf,
}

impl VaultBoundary {
    pub(crate) fn from_request(requested_vault_path: Option<&str>) -> Result<Self, String> {
        let configured_root = if cfg!(test) {
            None
        } else {
            load_configured_active_vault_root()?
        };
        let requested_root = requested_vault_path
            .filter(|path| !path.trim().is_empty())
            .map(build_vault_root_paths)
            .transpose()?;

        let root = match (configured_root, requested_root) {
            (Some(configured), Some(requested)) => {
                if configured.canonical != requested.canonical {
                    return Err(ACTIVE_VAULT_MISMATCH_ERROR.to_string());
                }
                requested
            }
            (Some(configured), None) => configured,
            (None, Some(requested)) => requested,
            (None, None) => return Err(NO_ACTIVE_VAULT_ERROR.to_string()),
        };

        Ok(Self {
            requested_root: root.requested,
            canonical_root: root.canonical,
        })
    }

    pub(crate) fn requested_root(&self) -> &Path {
        &self.requested_root
    }

    fn requested_root_str(&self) -> String {
        path_to_string(&self.requested_root)
    }

    fn validate_existing_path(&self, raw_path: &str) -> Result<String, String> {
        self.validate_path(raw_path, false)
    }

    pub(crate) fn validate_existing_paths(
        &self,
        raw_paths: &[String],
    ) -> Result<Vec<String>, String> {
        raw_paths
            .iter()
            .map(|path| self.validate_existing_path(path))
            .collect()
    }

    fn validate_writable_path(&self, raw_path: &str) -> Result<String, String> {
        self.validate_path(raw_path, true)
    }

    pub(crate) fn child_path(&self, relative_path: &str) -> Result<PathBuf, String> {
        validate_relative_child_path(relative_path)?;
        let requested = self.requested_root.join(relative_path);
        let canonical = canonicalize_candidate_for_write(&requested)?;
        self.ensure_within_root(&canonical)?;
        Ok(requested)
    }

    fn validate_path(&self, raw_path: &str, allow_missing_leaf: bool) -> Result<String, String> {
        let requested = self.requested_path(raw_path);
        let canonical = if allow_missing_leaf {
            canonicalize_candidate_for_write(&requested)?
        } else {
            requested
                .canonicalize()
                .map_err(|_| "File does not exist".to_string())?
        };
        self.ensure_within_root(&canonical)?;
        Ok(path_to_string(&requested))
    }

    fn requested_path(&self, raw_path: &str) -> PathBuf {
        let expanded = PathBuf::from(expand_tilde(raw_path).into_owned());
        if expanded.is_absolute() {
            expanded
        } else {
            self.requested_root.join(expanded)
        }
    }

    fn ensure_within_root(&self, candidate: &Path) -> Result<(), String> {
        candidate
            .strip_prefix(&self.canonical_root)
            .map(|_| ())
            .map_err(|_| ACTIVE_VAULT_PATH_ERROR.to_string())
    }
}

fn load_configured_active_vault_root() -> Result<Option<VaultRootPaths>, String> {
    let list = vault_list::load_vault_list()?;
    list.active_vault
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .map(build_vault_root_paths)
        .transpose()
}

fn build_vault_root_paths(raw_vault_path: &str) -> Result<VaultRootPaths, String> {
    let requested = PathBuf::from(expand_tilde(raw_vault_path).into_owned());
    let canonical = requested
        .canonicalize()
        .map_err(|_| ACTIVE_VAULT_UNAVAILABLE_ERROR.to_string())?;
    if !canonical.is_dir() {
        return Err(ACTIVE_VAULT_UNAVAILABLE_ERROR.to_string());
    }

    Ok(VaultRootPaths {
        requested,
        canonical,
    })
}

fn canonicalize_candidate_for_write(path: &Path) -> Result<PathBuf, String> {
    let (ancestor, tail) = find_existing_ancestor(path)?;
    Ok(tail
        .into_iter()
        .fold(ancestor, |current, segment| current.join(segment)))
}

fn find_existing_ancestor(path: &Path) -> Result<(PathBuf, Vec<OsString>), String> {
    let mut current = path;
    let mut tail = Vec::new();

    loop {
        if current.exists() {
            let canonical = current
                .canonicalize()
                .map_err(|_| ACTIVE_VAULT_PATH_ERROR.to_string())?;
            tail.reverse();
            return Ok((canonical, tail));
        }

        let file_name = current
            .file_name()
            .ok_or_else(|| ACTIVE_VAULT_PATH_ERROR.to_string())?;
        tail.push(file_name.to_os_string());
        current = current
            .parent()
            .ok_or_else(|| ACTIVE_VAULT_PATH_ERROR.to_string())?;
    }
}

fn validate_relative_child_path(relative_path: &str) -> Result<(), String> {
    if relative_path.trim().is_empty() {
        return Err(ACTIVE_VAULT_PATH_ERROR.to_string());
    }

    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err(ACTIVE_VAULT_PATH_ERROR.to_string());
    }

    if path.components().any(|component| {
        matches!(
            component,
            Component::CurDir | Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(ACTIVE_VAULT_PATH_ERROR.to_string());
    }

    Ok(())
}

pub(crate) fn validate_view_filename(filename: &str) -> Result<(), String> {
    if !filename.ends_with(".yml") {
        return Err("Filename must end with .yml".to_string());
    }

    let path = Path::new(filename);
    let mut components = path.components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(value)), None) => {
            let stem = value.to_string_lossy();
            let stem = stem.strip_suffix(".yml").unwrap_or(&stem);
            validate_view_filename_stem(stem)
        }
        _ => Err(INVALID_VIEW_FILENAME_ERROR.to_string()),
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub(crate) fn with_boundary<T>(
    requested_vault_path: Option<&str>,
    action: impl FnOnce(&VaultBoundary) -> Result<T, String>,
) -> Result<T, String> {
    let boundary = VaultBoundary::from_request(requested_vault_path)?;
    action(&boundary)
}

pub(crate) enum ValidatedPathMode {
    Existing,
    Writable,
}

pub(crate) fn with_validated_path<T>(
    path: &str,
    vault_path: Option<&str>,
    mode: ValidatedPathMode,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(vault_path, |boundary| {
        let validated_path = match mode {
            ValidatedPathMode::Existing => boundary.validate_existing_path(path)?,
            ValidatedPathMode::Writable => boundary.validate_writable_path(path)?,
        };
        action(&validated_path)
    })
}

pub(crate) fn with_existing_paths<T>(
    paths: &[String],
    vault_path: Option<&str>,
    action: impl FnOnce(Vec<String>) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(vault_path, |boundary| {
        let validated_paths = boundary.validate_existing_paths(paths)?;
        action(validated_paths)
    })
}

pub(crate) fn with_requested_root<T>(
    vault_path: &str,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(Some(vault_path), |boundary| {
        let requested_root = boundary.requested_root_str();
        action(&requested_root)
    })
}

pub(crate) fn with_existing_path_in_requested_vault<T>(
    vault_path: &str,
    path: &str,
    action: impl FnOnce(&str, &str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(Some(vault_path), |boundary| {
        let requested_root = boundary.requested_root_str();
        let validated_path = boundary.validate_existing_path(path)?;
        action(&requested_root, &validated_path)
    })
}

pub(crate) fn with_view_file<T>(
    vault_path: &str,
    filename: &str,
    action: impl FnOnce(&str, &str) -> Result<T, String>,
) -> Result<T, String> {
    with_boundary(Some(vault_path), |boundary| {
        validate_view_filename(filename)?;
        let requested_root = boundary.requested_root_str();
        action(&requested_root, filename)
    })
}
