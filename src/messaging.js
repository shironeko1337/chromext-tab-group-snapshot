// Send a request to the background worker and unwrap its { ok, result, error } reply.
export async function sendMessage(message) {
  const res = await chrome.runtime.sendMessage(message);
  if (!res?.ok) throw new Error(res?.error || 'Unknown error');
  return res.result;
}

// Pull snapshots from the Chrome account before a page shows them. Gives up
// after a few seconds so a slow sync never leaves the page blank; sync
// failures are shown on the options page instead.
export async function syncBeforeShowing() {
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([sendMessage({ type: 'sync' }).catch(() => {}), timeout]);
}
