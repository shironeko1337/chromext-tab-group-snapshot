# Privacy Policy — Snapshot Groups

_Last updated: October 31, 2026_

Snapshot Groups is a Chrome extension that saves snapshots of your tab groups and restores them later. This policy explains what information the extension handles and what it does with it.

## Summary

Your data is stored on your computer and, with auto sync on, in your own Chrome account. The extension does not send any data to the developer, has no servers, and contains no analytics, tracking or advertising.

## What the extension stores

When you save a snapshot, the extension stores, in Chrome's local extension storage on your device:

- the snapshot's name and the time it was saved;
- for each tab group: its name, color and whether it was collapsed;
- for each tab in a group: the page address (URL) and the nickname you gave it, if any.

While Chrome is open, the extension also keeps a temporary list of which restored tabs have a nickname, so it can show the nickname again if the page changes its own title. This list is held in Chrome's session storage and is cleared when the browser closes.

The extension does not read the content of web pages, your browsing history, form data, passwords, cookies or any personal information. Tabs that are not in a tab group are never read or stored.

## How the data is used

The stored data is used only to show your snapshots and to restore your tab groups when you ask. It is not used for any other purpose.

## Sharing

The data is not sold, shared with or transferred to the developer or any third party.

Auto sync is on by default. While it is on, your snapshots are also stored in Chrome's sync storage (chrome.storage.sync), which Chrome keeps in your Google account so they appear on your other computers where you are signed in to Chrome with sync turned on. This copy is handled by Google under your Google account settings and Google's privacy policy. You can turn auto sync off on the extension's options page; snapshots are then kept on this computer only. To remove the copy from your account, delete your snapshots while auto sync is on, or clear Chrome sync data in your Google account.

## Permissions

- **Tab groups:** to read your groups when saving and to create or update them when restoring.
- **Tabs:** to read the address of each tab in a group and to open saved pages when restoring.
- **Storage:** to keep your snapshots on your device.
- **Scripting and optional access to websites:** used only for page nicknames. When you restore a snapshot that has a nickname, the extension sets the title of that restored tab to the nickname. It does not read anything from the page. Chrome asks for this access only the first time you save a nickname, and you can decline it or remove it at any time from the extension's settings in Chrome.

## Your control over the data

- Delete any snapshot from the extension's options page.
- Uninstalling the extension deletes all of its data.

## Changes to this policy

If this policy changes, the updated version will be published at this address with a new "Last updated" date.

## Contact

Questions about this policy: open an issue at https://github.com/shironeko1337/chromext-tab-group-snapshot/issues
