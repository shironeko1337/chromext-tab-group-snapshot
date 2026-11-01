// Auto sync of snapshots with the user's Chrome account (chrome.storage.sync).
//
// chrome.storage.local is always the working copy. When auto sync is on,
// syncNow() merges the local copy with the account copy (newest version of each
// snapshot wins, deletions included; see mergeDbs) and writes the result to
// both. It runs when the popup or options page opens, after any change to the
// snapshots, and when auto sync is turned on. If the merged data is too big for
// the account, it is saved on this computer only.
//
// Sync storage allows 100 KB in total and 8 KB per item, so the data is stored
// as JSON split into numbered chunks plus one metadata item. Every chunk is
// tagged with the version it belongs to, so a half-arrived update from another
// computer is detected and skipped instead of being read as corrupt data.

import { getSettings, loadDb, mergeDbs, newId, saveDb } from './storage.js';

const META_KEY = 'backup_meta'; // { version, chunks, saved_time }
const chunkKey = (i) => `backup_${i}`; // { v: version, d: piece of JSON }
const STATE_KEY = 'syncState'; // in local storage: result of the last sync, for the options page

const TOTAL_LIMIT = chrome.storage.sync.QUOTA_BYTES ?? 102400;
const ITEM_LIMIT = chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? 8192;
const MAX_ITEMS = chrome.storage.sync.MAX_ITEMS ?? 512;

const encoder = new TextEncoder();

// Chrome counts an item as its key plus its value serialized as JSON, in bytes.
function itemBytes(key, value) {
  return encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;
}

function build(db) {
  const json = JSON.stringify(db);
  const version = newId();
  const items = {};
  let start = 0;
  let i = 0;
  while (start < json.length) {
    const key = chunkKey(i);
    let end = Math.min(json.length, start + ITEM_LIMIT);
    while (itemBytes(key, { v: version, d: json.slice(start, end) }) > ITEM_LIMIT) {
      end = start + Math.floor((end - start) * 0.9);
    }
    // Don't cut a surrogate pair (e.g. an emoji) in half.
    const last = json.charCodeAt(end - 1);
    if (end < json.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    items[key] = { v: version, d: json.slice(start, end) };
    start = end;
    i += 1;
  }
  items[META_KEY] = { version, chunks: i, saved_time: Date.now() };
  const bytes = Object.entries(items).reduce((sum, [k, v]) => sum + itemBytes(k, v), 0);
  return { items, chunks: i, bytes, fits: bytes <= TOTAL_LIMIT && i + 1 <= MAX_ITEMS };
}

// How much room the given db takes in the Chrome account.
export function measure(db) {
  const { bytes, fits } = build(db);
  return { bytes, limit: TOTAL_LIMIT, fits };
}

class IncompleteError extends Error {}

// The db stored in the account, or null if there is none.
async function readRemote() {
  const { [META_KEY]: meta } = await chrome.storage.sync.get(META_KEY);
  if (!meta) return null;
  const keys = Array.from({ length: meta.chunks }, (_, i) => chunkKey(i));
  const stored = await chrome.storage.sync.get(keys);
  if (keys.some((k) => stored[k]?.v !== meta.version)) {
    throw new IncompleteError('Waiting for the copy in your Chrome account to finish syncing.');
  }
  return JSON.parse(keys.map((k) => stored[k].d).join(''));
}

async function writeRemote(built, previousChunks) {
  // Drop chunks the new copy no longer uses first, so old and new data never
  // count against the quota together.
  const stale = [];
  for (let i = built.chunks; i < previousChunks; i++) stale.push(chunkKey(i));
  if (stale.length) await chrome.storage.sync.remove(stale);
  await chrome.storage.sync.set(built.items);
}

export async function getSyncState() {
  const { [STATE_KEY]: state } = await chrome.storage.local.get(STATE_KEY);
  return state ?? null;
}

async function setSyncState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: { ...state, time: Date.now() } });
}

const same = (a, b) => JSON.stringify(mergeDbs(a)) === JSON.stringify(mergeDbs(b));

let running = Promise.resolve();

// Merge local and account copies and save the result to both (account only if
// it fits). Does nothing when auto sync is off. Calls run one at a time.
export function syncNow() {
  running = running.catch(() => {}).then(doSync);
  return running;
}

async function doSync() {
  if (!(await getSettings()).autoSync) return;
  try {
    const local = await loadDb();
    const remote = await readRemote();
    const merged = mergeDbs(local, remote ?? undefined);

    if (!same(merged, local)) await saveDb(merged);

    const built = build(merged);
    if (!built.fits) {
      await setSyncState({ ok: false, tooLarge: true, error: 'Too large for your Chrome account. Saved on this computer only.' });
      return;
    }
    if (!remote || !same(merged, remote)) {
      const { [META_KEY]: meta } = await chrome.storage.sync.get(META_KEY);
      await writeRemote(built, meta?.chunks ?? 0);
    }
    await setSyncState({ ok: true });
  } catch (err) {
    await setSyncState({ ok: false, error: err instanceof IncompleteError ? err.message : `Sync failed: ${err.message}` });
  }
}
