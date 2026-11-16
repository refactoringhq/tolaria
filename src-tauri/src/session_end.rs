//! Windows can end the session (shutdown, logoff, or a Restart Manager request
//! from an installer) by sending `WM_ENDSESSION`. tao 0.35 answers it by
//! emitting `LoopDestroyed` (Tauri's `RunEvent::Exit`) without going through
//! Tauri's exit request, then keeps pumping window messages: the next one
//! panics with "cannot move state from Destroyed" (TOL-371). tao 0.37 fixes
//! this by exiting the process right after `LoopDestroyed`; Tauri 2 still ships
//! tao 0.35, so Tolaria does the same here.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager, RunEvent};

#[derive(Debug, Default)]
pub(crate) struct ExitLifecycle {
    exit_requested: AtomicBool,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub(crate) enum ExitFollowUp {
    /// Tauri asked to exit first, so the event loop shuts down on its own.
    FinishEventLoop,
    /// The OS destroyed the event loop behind Tauri's back (`WM_ENDSESSION`).
    TerminateProcess,
}

impl ExitLifecycle {
    pub(crate) fn record_exit_requested(&self) {
        self.exit_requested.store(true, Ordering::SeqCst);
    }

    pub(crate) fn follow_up_on_exit(&self) -> ExitFollowUp {
        if self.exit_requested.load(Ordering::SeqCst) {
            ExitFollowUp::FinishEventLoop
        } else {
            ExitFollowUp::TerminateProcess
        }
    }
}

/// Must run last for `RunEvent::Exit`: it may end the process.
pub(crate) fn handle_run_event(app_handle: &AppHandle, event: &RunEvent) {
    let lifecycle: tauri::State<'_, ExitLifecycle> = app_handle.state();
    match event {
        RunEvent::ExitRequested { .. } => lifecycle.record_exit_requested(),
        RunEvent::Exit if lifecycle.follow_up_on_exit() == ExitFollowUp::TerminateProcess => {
            terminate_after_session_end(app_handle)
        }
        _ => {}
    }
}

#[cfg(windows)]
fn terminate_after_session_end(app_handle: &AppHandle) {
    app_handle.cleanup_before_exit();
    std::process::exit(0);
}

#[cfg(not(windows))]
fn terminate_after_session_end(_app_handle: &AppHandle) {}

#[cfg(test)]
mod tests {
    use super::{ExitFollowUp, ExitLifecycle};

    #[test]
    fn exit_without_exit_request_terminates_the_process() {
        let lifecycle = ExitLifecycle::default();

        assert_eq!(
            lifecycle.follow_up_on_exit(),
            ExitFollowUp::TerminateProcess
        );
    }

    #[test]
    fn exit_after_exit_request_lets_the_event_loop_finish() {
        let lifecycle = ExitLifecycle::default();

        lifecycle.record_exit_requested();

        assert_eq!(lifecycle.follow_up_on_exit(), ExitFollowUp::FinishEventLoop);
    }
}
