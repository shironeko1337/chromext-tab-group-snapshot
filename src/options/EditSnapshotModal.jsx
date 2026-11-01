import { useEffect, useState } from 'react';
import { Button, ColorSwatchPicker, Input, Label, Modal, Table, TextField } from '@heroui/react';
import { defaultName, getSnapshot, newId, updateSnapshot } from '../storage.js';

// Chrome tab group colors.
const GROUP_COLORS = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#fa903e',
};

// Renaming page titles needs access to the pages. It is optional, so it is
// only requested once the user actually sets a nickname.
const SITE_ACCESS = { origins: ['<all_urls>'] };

// A URL Chrome can open in a tab: it must parse and have a scheme other than
// javascript: (which Chrome refuses to open from an extension).
function isValidUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol !== 'javascript:';
  } catch {
    return false;
  }
}

function colorNameFromHex(hex) {
  return Object.keys(GROUP_COLORS).find((k) => GROUP_COLORS[k].toLowerCase() === hex.toLowerCase());
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z"
      />
    </svg>
  );
}

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d={direction === 'up' ? 'M11 20V7.8l-5.6 5.6L4 12l8-8l8 8l-1.4 1.4L13 7.8V20z' : 'M13 4v12.2l5.6-5.6L20 12l-8 8l-8-8l1.4-1.4l5.6 5.6V4z'}
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
    </svg>
  );
}

// group: { id, name, color, rows: [{ key, url, nickname }] } being edited.
// canDelete: false for the last remaining group, which can't be deleted.
function GroupTable({ group, onChange, canDelete, onDelete }) {
  const label = group.name || 'unnamed group';
  const setRows = (rows) => onChange({ ...group, rows });
  const updateRow = (key, patch) => setRows(group.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const deleteRow = (key) => setRows(group.rows.filter((r) => r.key !== key));
  const addRow = () => setRows([...group.rows, { key: newId(), url: '', nickname: '' }]);
  // Swap the row at index with its neighbour above (-1) or below (+1).
  const moveRow = (index, delta) => {
    const rows = [...group.rows];
    [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]];
    setRows(rows);
  };
  const lastIndex = group.rows.length - 1;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-0 flex-1"
          aria-label="Group name"
          placeholder="Unnamed group"
          autoComplete="off"
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
        />
        <ColorSwatchPicker
          aria-label={`Color for ${label}`}
          size="xs"
          value={GROUP_COLORS[group.color] ?? GROUP_COLORS.grey}
          onChange={(c) => {
            const color = colorNameFromHex(c.toString('hex'));
            if (color) onChange({ ...group, color });
          }}
        >
          {Object.entries(GROUP_COLORS).map(([colorName, hex]) => (
            <ColorSwatchPicker.Item key={colorName} color={hex} aria-label={colorName}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
        <Button
          variant="danger-soft"
          size="sm"
          isIconOnly
          isDisabled={!canDelete}
          aria-label={canDelete ? `Delete group ${label}` : 'The last group cannot be deleted'}
          onPress={onDelete}
        >
          <TrashIcon />
        </Button>
      </div>
      <Table className="w-full">
        <Table.ScrollContainer>
          <Table.Content aria-label={`Tabs in ${label}`} className="w-full table-fixed">
            <Table.Header>
              <Table.Column className="w-12">#</Table.Column>
              <Table.Column isRowHeader>URL</Table.Column>
              <Table.Column className="w-64">Nickname</Table.Column>
              <Table.Column className="w-32">Actions</Table.Column>
            </Table.Header>
            <Table.Body>
              {group.rows.map((row, i) => {
                const invalid = row.url.trim() !== '' && !isValidUrl(row.url);
                return (
                  <Table.Row key={row.key} id={row.key}>
                    <Table.Cell className="text-muted">{i + 1}</Table.Cell>
                    <Table.Cell>
                      <Input
                        fullWidth
                        aria-label={`URL of tab ${i + 1}`}
                        aria-invalid={invalid || undefined}
                        className={invalid ? 'border-danger text-danger' : undefined}
                        placeholder="https://"
                        autoComplete="off"
                        title={invalid ? 'Not a valid URL; this tab will not be saved' : row.url}
                        value={row.url}
                        onChange={(e) => updateRow(row.key, { url: e.target.value })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        fullWidth
                        aria-label={`Nickname of tab ${i + 1}`}
                        placeholder="Page title"
                        autoComplete="off"
                        value={row.nickname}
                        onChange={(e) => updateRow(row.key, { nickname: e.target.value })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          isDisabled={i === 0}
                          aria-label={`Move tab ${i + 1} up`}
                          onPress={() => moveRow(i, -1)}
                        >
                          <ArrowIcon direction="up" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          isDisabled={i === lastIndex}
                          aria-label={`Move tab ${i + 1} down`}
                          onPress={() => moveRow(i, 1)}
                        >
                          <ArrowIcon direction="down" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          isDisabled={group.rows.length <= 1}
                          aria-label={
                            group.rows.length <= 1 ? 'The last tab cannot be deleted' : `Delete tab ${i + 1}`
                          }
                          onPress={() => deleteRow(row.key)}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
              {/* The whole row is the "add tab" button (click or Enter). */}
              <Table.Row id="__add" className="add-tab-row" textValue={`Add a tab to ${label}`} onAction={addRow}>
                <Table.Cell colSpan={4} aria-label={`Add a tab to ${label}`}>
                  <div className="flex justify-center">
                    <PlusIcon />
                  </div>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </section>
  );
}

// Dialog for one snapshot: rename it, edit or delete its groups, and edit their tabs.
export function EditSnapshotModal({ snapshotId, onClose }) {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  // Editable copy of the groups: [{ id, name, color, rows: [{ key, url, nickname }] }].
  // Changes, including deleted groups and tabs, are applied only on Save.
  const [groups, setGroups] = useState([]);
  const [deletedGroupIds, setDeletedGroupIds] = useState([]);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!snapshotId) return;
    let cancelled = false;
    setWarning('');
    setDeletedGroupIds([]);
    getSnapshot(snapshotId).then((d) => {
      if (cancelled) return;
      if (!d) return onClose();
      setData(d);
      setName(d.snapshot.name);
      setGroups(
        d.groups.map((g) => ({
          id: g.id,
          name: g.name,
          color: g.color || 'grey',
          rows: g.tabs.map((t) => ({ key: newId(), url: t.URL, nickname: t.nickname ?? '' })),
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  async function save() {
    // Only tabs with a valid URL are saved; a group needs at least one.
    const toSave = groups.map((g) => ({
      ...g,
      tabs: g.rows.filter((r) => isValidUrl(r.url)).map((r) => ({ URL: r.url.trim(), nickname: r.nickname })),
    }));
    const empty = toSave.find((g) => g.tabs.length === 0);
    if (empty) {
      setWarning(`"${empty.name || 'Unnamed group'}" needs at least one tab with a valid URL.`);
      return;
    }

    const hasNicknames = toSave.some((g) => g.tabs.some((t) => t.nickname !== ''));
    // Ask before any await so the request still counts as a user click.
    const access = hasNicknames ? chrome.permissions.request(SITE_ACCESS) : Promise.resolve(true);

    await updateSnapshot(snapshotId, {
      name,
      groups: toSave.map(({ id, name: groupName, color, tabs }) => ({ id, name: groupName, color, tabs })),
      deletedGroupIds,
    });

    if (await access.catch(() => false)) {
      onClose();
    } else {
      setWarning(
        'Saved. Nicknames will not rename tabs until you allow site access - press Save again to allow it.',
      );
    }
  }

  const isOpen = snapshotId != null && data?.snapshot.id === snapshotId;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          {/* 1.5x the "lg" width (32rem). */}
          <Modal.Dialog style={{ maxWidth: '48rem', width: '100%' }}>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Update snapshot</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-5">
              <TextField
                autoFocus
                value={name}
                onChange={setName}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              >
                <Label>Name</Label>
                <Input placeholder={data ? defaultName(data.snapshot.create_time) : ''} />
              </TextField>
              {groups.length ? (
                groups.map((g) => (
                  <GroupTable
                    key={g.id}
                    group={g}
                    onChange={(next) => setGroups((prev) => prev.map((p) => (p.id === g.id ? next : p)))}
                    canDelete={groups.length > 1}
                    onDelete={() => {
                      setGroups((prev) => prev.filter((p) => p.id !== g.id));
                      setDeletedGroupIds((prev) => [...prev, g.id]);
                    }}
                  />
                ))
              ) : (
                <p className="text-muted">This snapshot has no tab groups.</p>
              )}
              {warning && <p className="text-sm text-warning">{warning}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onPress={save}>
                Save
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
