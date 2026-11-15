export const mobileEditorLinkInteractionScript = `(() => {
  const key = '__tolariaMobileLinkInteractionInstalled__';
  if (window[key]) return true;
  window[key] = true;

  const anchorFor = (event) => {
    const target = event.target;
    if (target && typeof target.closest === 'function') return target.closest('a[href]');
    return target && target.parentElement && typeof target.parentElement.closest === 'function'
      ? target.parentElement.closest('a[href]')
      : null;
  };
  const send = (href, intent) => {
    const bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== 'function') return;
    bridge.postMessage(JSON.stringify({
      type: 'action',
      payload: { type: 'mobile-open-link', payload: { href, intent } },
    }));
  };
  const hasSelection = () => {
    const selection = window.getSelection && window.getSelection();
    return Boolean(selection && !selection.isCollapsed && selection.toString());
  };
  const isFollowGesture = (event) => {
    if (event.button !== 0) return false;
    if (hasSelection()) return false;
    return event.metaKey || event.ctrlKey;
  };

  document.addEventListener('click', (event) => {
    const anchor = anchorFor(event);
    if (!anchor) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isFollowGesture(event)) return;
    const href = anchor.getAttribute('href');
    if (href) send(href, 'open');
  }, true);

  document.addEventListener('contextmenu', (event) => {
    const anchor = anchorFor(event);
    if (!anchor) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (hasSelection()) return;
    const href = anchor.getAttribute('href');
    if (href) send(href, 'options');
  }, true);
  return true;
})()`;

export type MobileEditorLinkIntent = "open" | "options";

export function mobileEditorLinkIntent(value: unknown): MobileEditorLinkIntent {
	return value === "options" ? "options" : "open";
}
