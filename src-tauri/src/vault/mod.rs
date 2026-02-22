mod cache;
mod edit;
mod git;
pub(crate) mod parse;
mod rename;
mod scan;

// Re-export public API
pub use cache::scan_vault_cached;
pub use edit::{delete_frontmatter_property, purge_trash, save_image, update_frontmatter};
pub use parse::VaultEntry;
pub use rename::{rename_note, RenameResult};
pub use scan::get_note_content;

// Re-export from frontmatter crate for external consumers
pub use crate::frontmatter::FrontmatterValue;
