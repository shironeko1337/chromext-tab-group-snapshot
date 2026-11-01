# Chrome Web Store — permission justifications

Paste each block into the matching field of the "Privacy practices" tab (limit: 1000 characters each).

## Single purpose description

Lets users save snapshots of their open Chrome tab groups and restore them later. From the toolbar popup the user saves all open tab groups under a name (or a default date name), and picks a saved snapshot to restore it: groups that are already open are updated by opening any missing pages (no tabs are closed), and groups that are not open are recreated with their name and color. Ungrouped tabs are never touched. An options page lists all snapshots, where the user can rename a snapshot, rename or recolor its groups, delete it, or give individual pages a nickname that replaces the page's title when the snapshot is restored. All features serve this one purpose: saving and restoring tab groups.

## tabs justification

Used to read the URL of each tab inside the user's tab groups when they save a snapshot, and to open the saved pages as new background tabs and move them into the right group when they restore one. When restoring into a group that is already open, the extension reads that group's tabs to see which saved pages are already present, so it only opens the missing ones and never closes or reloads existing tabs. It also listens for tab updates and closures only to keep a page nickname applied to the tab it was restored into. Tab URLs are stored only on the user's device and are never sent anywhere.

## tabGroups justification

The core of the extension. Used to list the user's open tab groups and read each group's title, color and collapsed state when saving a snapshot, and to set the title, color and collapsed state of groups when restoring a snapshot, so the restored groups look the same as when they were saved.

## storage justification

Snapshots are saved with chrome.storage.local, only on the user's device, so they survive browser restarts. A snapshot contains its name and save time, each group's name, color and collapsed state, and the URLs of the pages in each group with any nickname the user set. chrome.storage.session holds, while the browser is open, which restored tab has which nickname, so the nickname can be applied again if the page changes its own title. Nothing is synced or sent to the developer or any server. The user can delete any snapshot on the options page; uninstalling removes all data.

## unlimitedStorage justification

_Leave blank — not requested._ The extension no longer asks for `unlimitedStorage`. Snapshots are small text (names, colors and URLs), so the standard 10 MB chrome.storage.local quota holds thousands of them, and requesting a permission that isn't clearly needed invites reviewer questions.

## scripting justification

Chrome has no API to change a tab's title. When the user has given a page a nickname in a snapshot and restores that snapshot, the extension uses chrome.scripting.executeScript to run a one-line function in that tab that sets document.title to the nickname. It runs only in tabs the extension itself restored with a nickname, reads nothing from the page, and stops as soon as the tab navigates to a different page or is closed. Without nicknames the extension never injects any script.

## Host permission justification

<all_urls> is an optional host permission. It is not granted on install: Chrome asks the user for it only when they save a page nickname on the options page. It is needed because nicknames can be set for any page the user keeps in a tab group, and chrome.scripting.executeScript needs host access to set that page's title. The extension uses it only for the single action described above (setting document.title in tabs it restored with a nickname). It does not read page content, collect data, or modify pages in any other way. If the user declines, everything else works and pages keep their own titles.

## Remote code

No, I am not using remote code. All JavaScript, including the React and HeroUI libraries, is bundled into the extension package.

## Data usage

The extension stores tab URLs, group names and user-entered names locally on the user's device only. No data is transmitted to the developer or any third party, so no user data is collected, sold, or used for purposes unrelated to saving and restoring tab groups.
