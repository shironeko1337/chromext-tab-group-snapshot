// Tab nicknames: replace a tab's page title with a user-chosen name.
//
// Chrome has no API to set a tab title, so we inject a script that sets
// document.title. Pages often reset their own title (on load, or in apps that
// update it live), so we re-apply it whenever Chrome reports a title change.
// A nickname belongs to one tab and one page: it is dropped when the tab
// navigates to a different URL or is closed.
//
// Requires the optional "<all_urls>" host permission, requested by the options
// page. Without it, or on pages Chrome protects (chrome://, the Web Store),
// injection fails quietly and the page keeps its own title.

const KEY = 'nicknames'; // { [tabId]: { nickname, url } }, url = page the nickname belongs to

async function load() {
  const { [KEY]: map } = await chrome.storage.session.get(KEY);
  return map ?? {};
}

async function store(map) {
  await chrome.storage.session.set({ [KEY]: map });
}

function samePage(a, b) {
  return a.split('#')[0] === b.split('#')[0];
}

// Browsers strip ordinary spaces from the ends of a page title, so a nickname
// of " " would become an empty title and Chrome would show the URL instead.
// Non-breaking spaces are not stripped, so spaces are kept as typed (a
// space-only nickname leaves just the favicon visible).
function toTitle(nickname) {
  return nickname.replace(/ /g, ' ');
}

async function setTitle(tabId, nickname) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (title) => {
        if (document.title !== title) document.title = title;
      },
      args: [toTitle(nickname)],
    });
  } catch {
    // No host permission, protected page, or the tab is still loading.
  }
}

// loaded: whether the tab already shows its page. If it is still loading, the
// page URL is recorded once loading finishes, so redirects don't drop the nickname.
export async function assignNickname(tab, nickname, { loaded }) {
  const map = await load();
  map[tab.id] = { nickname, url: loaded ? tab.url || null : null };
  await store(map);
  if (loaded) await setTitle(tab.id, nickname);
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!info.url && !info.title && info.status !== 'complete') return;
  const map = await load();
  const entry = map[tabId];
  if (!entry) return;

  if (info.url && entry.url && !samePage(info.url, entry.url)) {
    delete map[tabId];
    await store(map);
    return;
  }
  if (info.status === 'complete' && !entry.url && tab.url) {
    entry.url = tab.url;
    await store(map);
  }
  if (tab.title !== toTitle(entry.nickname)) await setTitle(tabId, entry.nickname);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await load();
  if (!(tabId in map)) return;
  delete map[tabId];
  await store(map);
});
