import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Re-check the deployed service worker this often while a tab stays open, so
// a build pushed while someone is at the table is noticed without a restart.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

interface UpdateToastProps {
  // When true (the home screen) an available update is applied straight
  // away by reloading; otherwise the player is offered a Reload button so a
  // hand in progress is not interrupted.
  canAutoReload: boolean;
}

export function UpdateToast({ canAutoReload }: UpdateToastProps) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        // A failed check (offline, server asleep) is simply retried next time.
        void registration.update().catch(() => undefined);
      }, UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (needRefresh && canAutoReload) void updateServiceWorker(true);
  }, [needRefresh, canAutoReload, updateServiceWorker]);

  if (!needRefresh || canAutoReload) return null;

  return (
    <div className="update-toast" role="status">
      <span>A new version of 28 is ready.</span>
      <button type="button" className="btn btn-primary btn-small" onClick={() => void updateServiceWorker(true)}>
        Reload
      </button>
      <button type="button" className="btn-link" onClick={() => setNeedRefresh(false)} aria-label="Later">
        Later
      </button>
    </div>
  );
}
