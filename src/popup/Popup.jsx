import { useEffect, useState } from 'react';
import { Button, InputGroup, Label, ListBox, Separator, Spinner, Switch } from '@heroui/react';
import { defaultName, displayName, getSettings, listSnapshots, setSettings } from '../storage.js';
import { sendMessage, syncBeforeShowing } from '../messaging.js';

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"
      />
    </svg>
  );
}

export function Popup() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [status, setStatus] = useState(null); // { text, error }
  const [allWindows, setAllWindows] = useState(false);
  const [ready, setReady] = useState(false); // false until the first sync finishes

  // Every saved snapshot appears in the menu, newest first.
  const refresh = async () => setSnapshots(await listSnapshots());

  useEffect(() => {
    // Pull the latest snapshots from the Chrome account before showing anything.
    (async () => {
      await syncBeforeShowing();
      setAllWindows((await getSettings()).allWindows);
      await refresh();
      setReady(true);
    })();
  }, []);

  function toggleAllWindows(value) {
    setAllWindows(value);
    setSettings({ allWindows: value });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // The popup belongs to the window it was opened from.
      const windowId = allWindows ? undefined : (await chrome.windows.getCurrent()).id;
      await sendMessage({ type: 'save', name, windowId });
      setName('');
      setStatus({ text: 'Saved.' });
      await refresh();
    } catch (err) {
      setStatus({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  async function restore(id) {
    const snapshot = snapshots.find((s) => s.id === id);
    setStatus({ text: `Restoring "${snapshot ? displayName(snapshot) : ''}"...` });
    try {
      await sendMessage({ type: 'restore', id });
      window.close();
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
  }

  if (!ready) {
    return (
      <div className="flex w-[300px] items-center justify-center gap-2 p-4 text-xs text-muted">
        <Spinner size="sm" /> Syncing...
      </div>
    );
  }

  return (
    <div className="flex w-[300px] flex-col gap-2 p-2">
      <form onSubmit={save}>
        <InputGroup fullWidth className="h-8 min-h-8 rounded-full text-sm">
          <InputGroup.Input
            aria-label="Snapshot name"
            className="text-sm"
            autoFocus
            autoComplete="off"
            placeholder={defaultName()}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <InputGroup.Suffix className="pr-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isIconOnly
              isPending={saving}
              aria-label="Save current tab groups"
              className="size-6 min-w-6 rounded-full"
            >
              <SaveIcon />
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
      </form>

      <Switch size="sm" isSelected={allWindows} onChange={toggleAllWindows} className="px-2">
        <Switch.Content className="w-full justify-between">
          <Label className="text-xs">Snapshot groups in all windows</Label>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>

      {status && (
        <p className={`px-2 text-xs ${status.error ? 'text-danger' : 'text-muted'}`}>{status.text}</p>
      )}

      {snapshots.length > 0 && (
        <>
          <Separator />
          <ListBox
            aria-label="Saved snapshots"
            selectionMode="none"
            items={snapshots}
            onAction={(key) => restore(String(key))}
          >
            {(s) => (
              <ListBox.Item id={s.id} textValue={displayName(s)}>
                <span className="truncate">{displayName(s)}</span>
              </ListBox.Item>
            )}
          </ListBox>
        </>
      )}
    </div>
  );
}
