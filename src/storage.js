// Local persistence for snapshots, using the normalized data structure:
//   Snapshot { id, name, create_time, update_time }
//   TabGroup { id, snapshot_id, name, color, collapsed }
//   Tab      { tab_group_id, URL, nickname }  (empty nickname = keep the page's own title)
//   deleted  [{ id, time }]  records of deleted snapshots, so a deletion also
//                            reaches other computers through Chrome sync
// Everything lives in chrome.storage.local, so it survives browser restarts.
// sync.js mirrors it to the user's Chrome account when auto sync is on.

const KEY = 'db';

function emptyDb() {
  return { snapshots: [], tabGroups: [], tabs: [], deleted: [] };
}

export async function loadDb() {
  const { [KEY]: db } = await chrome.storage.local.get(KEY);
  return db ? { ...emptyDb(), ...db } : emptyDb();
}

export async function saveDb(db) {
  await chrome.storage.local.set({ [KEY]: db });
}

// Popup preferences, kept separately from snapshot data.
const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS = { allWindows: false, autoSync: true };

export async function getSettings() {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function setSettings(patch) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...(await getSettings()), ...patch } });
}

export function newId() {
  return crypto.randomUUID();
}

// "MM/DD/YYYY Groups"
export function defaultName(time = Date.now()) {
  const d = new Date(time);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()} Groups`;
}

// Name shown to the user. An empty stored name means the user didn't pick one.
export function displayName(snapshot) {
  return snapshot.name || defaultName(snapshot.create_time);
}

// Deletion records older than this are dropped; a computer that has not synced
// for longer may bring a deleted snapshot back.
const DELETED_KEEP_MS = 90 * 24 * 60 * 60 * 1000;

const updatedAt = (snapshot) => snapshot.update_time ?? snapshot.create_time;

// Merge two dbs, snapshot by snapshot: the most recently updated version of
// each snapshot wins, and a deletion wins over any version older than it.
// The result is in a fixed order, so equal content gives equal JSON.
export function mergeDbs(a, b = emptyDb()) {
  const deleted = new Map();
  for (const d of [...(a.deleted ?? []), ...(b.deleted ?? [])]) {
    if (Date.now() - d.time > DELETED_KEEP_MS) continue;
    deleted.set(d.id, Math.max(d.time, deleted.get(d.id) ?? 0));
  }

  // Snapshot id -> { snapshot, db it came from }
  const chosen = new Map();
  for (const db of [a, b]) {
    for (const snapshot of db.snapshots ?? []) {
      const current = chosen.get(snapshot.id);
      if (!current || updatedAt(snapshot) > updatedAt(current.snapshot)) chosen.set(snapshot.id, { snapshot, db });
    }
  }

  const result = emptyDb();
  for (const id of [...chosen.keys()].sort()) {
    const { snapshot, db } = chosen.get(id);
    if (deleted.has(id) && deleted.get(id) >= updatedAt(snapshot)) continue;
    const groups = (db.tabGroups ?? []).filter((g) => g.snapshot_id === id);
    const groupIds = new Set(groups.map((g) => g.id));
    result.snapshots.push(snapshot);
    result.tabGroups.push(...groups);
    result.tabs.push(...(db.tabs ?? []).filter((t) => groupIds.has(t.tab_group_id)));
  }
  result.deleted = [...deleted.keys()].sort().map((id) => ({ id, time: deleted.get(id) }));
  return result;
}

export async function listSnapshots() {
  const db = await loadDb();
  return [...db.snapshots].sort((a, b) => b.create_time - a.create_time);
}

// Returns { snapshot, groups: [{ ...TabGroup, tabs: [Tab] }] }
export async function getSnapshot(id) {
  const db = await loadDb();
  const snapshot = db.snapshots.find((s) => s.id === id);
  if (!snapshot) return null;
  const groups = db.tabGroups
    .filter((g) => g.snapshot_id === id)
    .map((g) => ({ ...g, tabs: db.tabs.filter((t) => t.tab_group_id === g.id) }));
  return { snapshot, groups };
}

// groups: [{ name, color, collapsed, urls: [string] }]
export async function addSnapshot(name, groups) {
  const db = await loadDb();
  const now = Date.now();
  const snapshot = { id: newId(), name: name.trim(), create_time: now, update_time: now };
  db.snapshots.push(snapshot);
  for (const g of groups) {
    const group = {
      id: newId(),
      snapshot_id: snapshot.id,
      name: g.name,
      color: g.color,
      collapsed: g.collapsed,
    };
    db.tabGroups.push(group);
    for (const url of g.urls) db.tabs.push({ tab_group_id: group.id, URL: url, nickname: '' });
  }
  await saveDb(db);
  return snapshot;
}

// groups: [{ id, name, color, tabs?: [{ URL, nickname }] }] for the snapshot's
// tab groups. When `tabs` is given it replaces that group's saved tabs, in order;
// duplicate URLs keep only the first.
// deletedGroupIds: groups to remove along with their tabs. A snapshot always
// keeps at least one group, so a request to delete every group is ignored.
export async function updateSnapshot(id, { name, groups = [], deletedGroupIds = [] }) {
  const db = await loadDb();
  const snapshot = db.snapshots.find((s) => s.id === id);
  if (!snapshot) return;
  snapshot.name = name.trim();
  snapshot.update_time = Date.now();

  const ownGroupIds = db.tabGroups.filter((g) => g.snapshot_id === id).map((g) => g.id);
  const toDelete = new Set(deletedGroupIds.filter((gid) => ownGroupIds.includes(gid)));
  if (toDelete.size > 0 && toDelete.size < ownGroupIds.length) {
    db.tabGroups = db.tabGroups.filter((g) => !toDelete.has(g.id));
    db.tabs = db.tabs.filter((t) => !toDelete.has(t.tab_group_id));
  }

  for (const g of groups) {
    const group = db.tabGroups.find((tg) => tg.id === g.id && tg.snapshot_id === id);
    if (!group) continue;
    group.name = g.name.trim();
    if (g.color) group.color = g.color;

    if (!g.tabs) continue;
    const seen = new Set();
    const tabs = [];
    for (const t of g.tabs) {
      const url = t.URL.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      // Nickname is not trimmed: a space-only nickname blanks the title.
      tabs.push({ tab_group_id: group.id, URL: url, nickname: t.nickname ?? '' });
    }
    if (!tabs.length) continue; // a group always keeps at least one tab
    db.tabs = db.tabs.filter((t) => t.tab_group_id !== group.id).concat(tabs);
  }
  await saveDb(db);
}

export async function deleteSnapshot(id) {
  const db = await loadDb();
  const groupIds = new Set(db.tabGroups.filter((g) => g.snapshot_id === id).map((g) => g.id));
  db.snapshots = db.snapshots.filter((s) => s.id !== id);
  db.tabGroups = db.tabGroups.filter((g) => !groupIds.has(g.id));
  db.tabs = db.tabs.filter((t) => !groupIds.has(t.tab_group_id));
  db.deleted = [...(db.deleted ?? []).filter((d) => d.id !== id), { id, time: Date.now() }];
  await saveDb(db);
}
