// Local persistence for snapshots, using the normalized data structure:
//   Snapshot { id, name, create_time }
//   TabGroup { id, snapshot_id, name, color, collapsed }
//   Tab      { tab_group_id, URL, nickname }  (empty nickname = keep the page's own title)
// Everything lives in chrome.storage.local, so it survives browser restarts.

const KEY = 'db';

function emptyDb() {
  return { snapshots: [], tabGroups: [], tabs: [] };
}

export async function loadDb() {
  const { [KEY]: db } = await chrome.storage.local.get(KEY);
  return db ? { ...emptyDb(), ...db } : emptyDb();
}

async function saveDb(db) {
  await chrome.storage.local.set({ [KEY]: db });
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
  const snapshot = { id: newId(), name: name.trim(), create_time: Date.now() };
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

// groups: [{ id, name, color }] for the snapshot's tab groups.
// nicknames: [{ tab_group_id, URL, nickname }]. A tab is identified by its
// group and URL, since URLs are unique within a saved group.
export async function updateSnapshot(id, { name, groups = [], nicknames = [] }) {
  const db = await loadDb();
  const snapshot = db.snapshots.find((s) => s.id === id);
  if (!snapshot) return;
  snapshot.name = name.trim();
  for (const g of groups) {
    const group = db.tabGroups.find((tg) => tg.id === g.id && tg.snapshot_id === id);
    if (!group) continue;
    group.name = g.name.trim();
    if (g.color) group.color = g.color;
  }
  for (const n of nicknames) {
    const tab = db.tabs.find((t) => t.tab_group_id === n.tab_group_id && t.URL === n.URL);
    if (tab) tab.nickname = n.nickname; // not trimmed: a space-only nickname blanks the title
  }
  await saveDb(db);
}

export async function deleteSnapshot(id) {
  const db = await loadDb();
  const groupIds = new Set(db.tabGroups.filter((g) => g.snapshot_id === id).map((g) => g.id));
  db.snapshots = db.snapshots.filter((s) => s.id !== id);
  db.tabGroups = db.tabGroups.filter((g) => !groupIds.has(g.id));
  db.tabs = db.tabs.filter((t) => !groupIds.has(t.tab_group_id));
  await saveDb(db);
}
