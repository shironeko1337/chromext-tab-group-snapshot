import { useEffect, useState } from 'react';
import { Card, Label, ProgressBar, Switch } from '@heroui/react';
import { Help } from './Help.jsx';
import { getSettings, loadDb, setSettings } from '../storage.js';
import { getSyncState, measure } from '../sync.js';

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// Auto sync switch, plus how much room the snapshots take in the Chrome account.
export function SyncCard() {
  const [autoSync, setAutoSync] = useState(true);
  const [usage, setUsage] = useState(null); // { bytes, limit, fits }
  const [state, setState] = useState(null); // result of the last sync

  useEffect(() => {
    const refresh = async () => {
      setAutoSync((await getSettings()).autoSync);
      setUsage(measure(await loadDb()));
      setState(await getSyncState());
    };
    refresh();
    const onChanged = (_changes, area) => area === 'local' && refresh();
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  // Turning it on triggers a sync in the background worker.
  function toggle(value) {
    setAutoSync(value);
    setSettings({ autoSync: value });
  }

  if (!usage) return null;
  const ratio = usage.bytes / usage.limit;
  const color = !usage.fits ? 'danger' : ratio > 0.8 ? 'warning' : 'accent';

  let status;
  if (!autoSync) status = { text: 'Snapshots are saved on this computer only.' };
  else if (!usage.fits)
    status = {
      text: 'Too large for your Chrome account, so snapshots are saved on this computer only. Delete some snapshots or tabs to sync again.',
      error: true,
    };
  else if (state && !state.ok) status = { text: state.error, error: true };
  else if (state) status = { text: `Synced ${new Date(state.time).toLocaleString()}` };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-1.5">
          <Card.Title>Sync</Card.Title>
          <Help label="About sync">
            <p>
              Snapshots are always saved on this computer. With auto sync on, they are also kept in your Chrome
              account and shared with your other computers.
            </p>
            <p className="mt-2">
              Your other computers only receive snapshots if you are signed in to Chrome there with sync turned
              on for extensions.
            </p>
          </Help>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <Switch isSelected={autoSync} onChange={toggle}>
          <Switch.Content className="w-full justify-between">
            <Label>Auto sync with Chrome account</Label>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>

        <ProgressBar
          value={Math.min(usage.bytes, usage.limit)}
          maxValue={usage.limit}
          color={color}
          valueLabel={`${formatKB(usage.bytes)} of ${formatKB(usage.limit)}`}
        >
          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Label>Size in Chrome account</Label>
              <Help label="About the size limit">
                Chrome allows {formatKB(usage.limit)} of sync storage per extension. When your snapshots reach
                that limit, auto sync fails: changes are still saved on this computer, but no longer reach your
                Chrome account or other computers until you delete some snapshots or tabs.
              </Help>
            </div>
            <ProgressBar.Output />
          </div>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>

        {status && <p className={`text-sm ${status.error ? 'text-danger' : 'text-muted'}`}>{status.text}</p>}
      </Card.Content>
    </Card>
  );
}
