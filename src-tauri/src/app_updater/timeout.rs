use std::future::Future;
use std::time::Duration;

pub(super) async fn timeout_updater_check<T, E, F, Factory>(
    operation: Factory,
    timeout: Duration,
) -> Result<Result<T, E>, tokio::time::error::Elapsed>
where
    F: Future<Output = Result<T, E>>,
    Factory: FnOnce() -> F,
{
    tokio::time::timeout(timeout, operation()).await
}

#[cfg(test)]
mod tests {
    use super::timeout_updater_check;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use std::time::Duration;

    struct DropSignal(Arc<AtomicBool>);

    impl Drop for DropSignal {
        fn drop(&mut self) {
            self.0.store(true, Ordering::SeqCst);
        }
    }

    #[tokio::test]
    async fn updater_check_timeout_drops_the_in_flight_operation() {
        let dropped = Arc::new(AtomicBool::new(false));
        let operation_dropped = Arc::clone(&dropped);
        let operation = || async move {
            let _drop_signal = DropSignal(operation_dropped);
            std::future::pending::<Result<(), &'static str>>().await
        };

        let result = timeout_updater_check(operation, Duration::from_millis(10)).await;

        assert!(result.is_err(), "the pending updater check should time out");
        assert!(
            dropped.load(Ordering::SeqCst),
            "the timed-out updater check future must be dropped"
        );
    }
}
