// Send a request to the background worker and unwrap its { ok, result, error } reply.
export async function sendMessage(message) {
  const res = await chrome.runtime.sendMessage(message);
  if (!res?.ok) throw new Error(res?.error || 'Unknown error');
  return res.result;
}
