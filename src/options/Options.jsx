import { useEffect, useState } from 'react';
import { AlertDialog, Button, Card, Spinner } from '@heroui/react';
import { deleteSnapshot, displayName, listSnapshots } from '../storage.js';
import { EditSnapshotModal } from './EditSnapshotModal.jsx';
import { SyncCard } from './SyncCard.jsx';
import { Help } from './Help.jsx';
import { syncBeforeShowing } from '../messaging.js';

export function Options() {
  const [snapshots, setSnapshots] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null); // snapshot pending delete confirmation

  useEffect(() => {
    const refresh = async () => setSnapshots(await listSnapshots());
    // Pull the latest snapshots from the Chrome account first.
    syncBeforeShowing().then(refresh);
    // Re-render on any storage change (rename, delete, or a save from the popup).
    const onChanged = (_changes, area) => area === 'local' && refresh();
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  async function confirmDelete() {
    const target = deleting;
    setDeleting(null);
    if (target) await deleteSnapshot(target.id);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Snapshots</h1>
        <Help label="About snapshots">
          Each snapshot is a saved set of tab groups: their names and colors, and the address (URL) of each
          page in them. Only URLs are kept, not the pages' history, scroll position or anything you typed.
        </Help>
      </div>

      {snapshots == null && (
        <div className="flex items-center gap-2 text-muted">
          <Spinner size="sm" /> Syncing...
        </div>
      )}

      {snapshots?.length === 0 && (
        <p className="text-muted">No snapshots yet. Use the toolbar button to save your tab groups.</p>
      )}

      {snapshots?.map((s) => (
        <Card key={s.id} className="flex-row items-center gap-3">
          <Card.Header className="min-w-0 flex-1">
            <Card.Title className="truncate">{displayName(s)}</Card.Title>
            <Card.Description>Saved {new Date(s.create_time).toLocaleString()}</Card.Description>
          </Card.Header>
          <Button variant="secondary" size="sm" onPress={() => setEditingId(s.id)}>
            Update
          </Button>
          <Button variant="danger-soft" size="sm" onPress={() => setDeleting(s)}>
            Delete
          </Button>
        </Card>
      ))}

      <div className="mt-4">
        <SyncCard />
      </div>

      <EditSnapshotModal snapshotId={editingId} onClose={() => setEditingId(null)} />

      <AlertDialog isOpen={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Delete snapshot?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  "{deleting && displayName(deleting)}" will be removed permanently. Your open tabs are not
                  affected.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={() => setDeleting(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onPress={confirmDelete}>
                  Delete
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </main>
  );
}
