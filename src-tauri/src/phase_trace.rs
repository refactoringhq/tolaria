//! Opt-in timings for backend vault phases, printed to stderr next to the
//! renderer startup milestones when `TOLARIA_STARTUP_TRACE=1`.

use std::path::Path;
use std::sync::OnceLock;
use std::time::Instant;

pub(crate) struct PhaseTimer {
    name: &'static str,
    vault: String,
    started: Instant,
}

pub(crate) fn start(name: &'static str, vault: &Path) -> PhaseTimer {
    PhaseTimer {
        name,
        vault: vault
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default(),
        started: Instant::now(),
    }
}

impl PhaseTimer {
    pub(crate) fn finish(self, items: usize) {
        if !enabled() {
            return;
        }
        let line = serde_json::json!({
            "name": self.name,
            "vault": self.vault,
            "ms": self.started.elapsed().as_millis() as u64,
            "items": items,
        });
        eprintln!("TOLARIA_PHASE_TRACE {line}");
    }
}

fn enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| std::env::var("TOLARIA_STARTUP_TRACE").as_deref() == Ok("1"))
}
