import { addSnapshot, getSnapshot } from './storage.js';
import { assignNickname } from './nicknames.js';
import { syncNow } from './sync.js';

// Popup and options pages send messages here so long-running work
// (opening tabs) is not cut off when the popup closes.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    save: () => saveCurrentGroups(msg.name ?? '', msg.windowId),
    restore: () => restoreSnapshot(msg.id),
    sync: () => syncNow(),
  };
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));
  return true; // async response
});

function tabUrl(tab) {
  return tab.url || tab.pendingUrl || '';
}

// Save the open tab groups of one window, or of all windows when windowId is
// not given. Ungrouped tabs are ignored.
async function saveCurrentGroups(name, windowId) {
  const chromeGroups = await chrome.tabGroups.query(windowId != null ? { windowId } : {});
  const groups = [];
  for (const cg of chromeGroups) {
    const tabs = await chrome.tabs.query({ groupId: cg.id });
    tabs.sort((a, b) => a.index - b.index);
    // Save rule: tabs with the same URL are saved once.
    const urls = [...new Set(tabs.map(tabUrl).filter(Boolean))];
    groups.push({ name: cg.title ?? '', color: cg.color, collapsed: cg.collapsed, urls });
  }
  return addSnapshot(name, groups);
}

// Make open tab groups match the snapshot.
// - A snapshot group matches an open group with the same name; that group is
//   updated: missing URLs are opened and added, no tabs are closed.
// - Snapshot groups with no open match are created in the focused window.
// - Other open groups and ungrouped tabs are left alone.
// - Tabs with a nickname get that nickname as their page title.
async function restoreSnapshot(id) {
  const data = await getSnapshot(id);
  if (!data) throw new Error('Snapshot not found');

  const openGroups = await chrome.tabGroups.query({});
  const used = new Set();
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);

  for (const group of data.groups) {
    const match = openGroups.find((g) => !used.has(g.id) && (g.title ?? '') === group.name);
    if (match) {
      used.add(match.id);
      await updateGroup(match, group);
    } else {
      await createGroup(group, win?.id);
    }
  }
}

async function updateGroup(chromeGroup, group) {
  const existing = await chrome.tabs.query({ groupId: chromeGroup.id });
  const have = new Set(existing.map(tabUrl));
  const missing = group.tabs.filter((t) => !have.has(t.URL));

  // Existing tabs keep their state; only their title is renamed if a nickname is set.
  for (const t of group.tabs) {
    if (!t.nickname) continue;
    for (const tab of existing.filter((e) => tabUrl(e) === t.URL)) {
      await assignNickname(tab, t.nickname, { loaded: tab.status === 'complete' });
    }
  }

  const tabIds = await openTabs(missing, chromeGroup.windowId);
  if (tabIds.length) await chrome.tabs.group({ groupId: chromeGroup.id, tabIds });
  await applyMetadata(chromeGroup.id, group);
}

async function createGroup(group, windowId) {
  const tabs = group.tabs.length ? group.tabs : [{ URL: undefined }];
  const tabIds = await openTabs(tabs, windowId);
  if (!tabIds.length) return;
  const groupId = await chrome.tabs.group({
    tabIds,
    createProperties: windowId != null ? { windowId } : undefined,
  });
  await applyMetadata(groupId, group);
}

// Opens snapshot tabs in the background and returns their new tab IDs.
async function openTabs(snapshotTabs, windowId) {
  const ids = [];
  for (const t of snapshotTabs) {
    try {
      const tab = await chrome.tabs.create({ url: t.URL, windowId, active: false });
      ids.push(tab.id);
      if (t.nickname) await assignNickname(tab, t.nickname, { loaded: false });
    } catch (err) {
      console.warn('Could not open', t.URL, err);
    }
  }
  return ids;
}

async function applyMetadata(groupId, group) {
  const props = { title: group.name };
  if (group.color) props.color = group.color;
  if (typeof group.collapsed === 'boolean') props.collapsed = group.collapsed;
  await chrome.tabGroups.update(groupId, props);
}

// Auto sync: whenever snapshots change on this computer (from the popup, the
// options page, or a sync itself), sync them with the Chrome account. A sync
// that changes nothing writes nothing, so this settles after one round.
// Turning auto sync on also syncs once.
let syncTimer;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const autoSync = (settings) => settings?.autoSync ?? true;
  const turnedOn =
    changes.settings && autoSync(changes.settings.newValue) && !autoSync(changes.settings.oldValue);
  if (!changes.db && !turnedOn) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 500); // group quick successive changes
});
