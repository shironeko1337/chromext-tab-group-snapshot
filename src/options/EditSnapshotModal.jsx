import { useEffect, useState } from 'react';
import { Button, ColorSwatchPicker, Input, Label, Modal, Table, TextField } from '@heroui/react';
import { defaultName, getSnapshot, updateSnapshot } from '../storage.js';

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

// A tab is identified by its group and URL (URLs are unique within a saved group).
const tabKey = (tab) => `${tab.tab_group_id}\n${tab.URL}`;

function colorNameFromHex(hex) {
  return Object.keys(GROUP_COLORS).find((k) => GROUP_COLORS[k].toLowerCase() === hex.toLowerCase());
}

// group: the saved group; edit: { name, color } being edited for it.
function GroupTable({ group, edit, onGroupChange, nicknames, onNicknameChange }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-0 flex-1"
          aria-label="Group name"
          placeholder="Unnamed group"
          autoComplete="off"
          value={edit.name}
          onChange={(e) => onGroupChange({ ...edit, name: e.target.value })}
        />
        <ColorSwatchPicker
          aria-label={`Color for ${edit.name || 'unnamed group'}`}
          size="xs"
          value={GROUP_COLORS[edit.color] ?? GROUP_COLORS.grey}
          onChange={(c) => {
            const color = colorNameFromHex(c.toString('hex'));
            if (color) onGroupChange({ ...edit, color });
          }}
        >
          {Object.entries(GROUP_COLORS).map(([colorName, hex]) => (
            <ColorSwatchPicker.Item key={colorName} color={hex} aria-label={colorName}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={`Tabs in ${edit.name || 'unnamed group'}`} className="table-fixed">
            <Table.Header>
              <Table.Column className="w-12">#</Table.Column>
              <Table.Column isRowHeader>URL</Table.Column>
              <Table.Column className="w-56">Nickname</Table.Column>
            </Table.Header>
            <Table.Body>
              {group.tabs.map((tab, i) => (
                <Table.Row key={tab.URL} id={tab.URL}>
                  <Table.Cell className="text-muted">{i + 1}</Table.Cell>
                  <Table.Cell className="truncate" title={tab.URL}>
                    {tab.URL}
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      fullWidth
                      aria-label={`Nickname for ${tab.URL}`}
                      placeholder="Page title"
                      autoComplete="off"
                      value={nicknames[tabKey(tab)] ?? ''}
                      onChange={(e) => onNicknameChange(tabKey(tab), e.target.value)}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </section>
  );
}

// Dialog for one snapshot: rename it and set tab nicknames.
export function EditSnapshotModal({ snapshotId, onClose }) {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [nicknames, setNicknames] = useState({});
  const [groupEdits, setGroupEdits] = useState({}); // { [groupId]: { name, color } }
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!snapshotId) return;
    let cancelled = false;
    setWarning('');
    getSnapshot(snapshotId).then((d) => {
      if (cancelled) return;
      if (!d) return onClose();
      setData(d);
      setName(d.snapshot.name);
      setGroupEdits(Object.fromEntries(d.groups.map((g) => [g.id, { name: g.name, color: g.color || 'grey' }])));
      setNicknames(
        Object.fromEntries(d.groups.flatMap((g) => g.tabs.map((t) => [tabKey(t), t.nickname ?? '']))),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  async function save() {
    const hasNicknames = Object.values(nicknames).some((n) => n !== '');
    // Ask before any await so the request still counts as a user click.
    const access = hasNicknames ? chrome.permissions.request(SITE_ACCESS) : Promise.resolve(true);

    const tabs = data.groups.flatMap((g) => g.tabs);
    await updateSnapshot(snapshotId, {
      name,
      groups: Object.entries(groupEdits).map(([id, g]) => ({ id, ...g })),
      nicknames: tabs.map((t) => ({
        tab_group_id: t.tab_group_id,
        URL: t.URL,
        nickname: nicknames[tabKey(t)] ?? '',
      })),
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
          <Modal.Dialog>
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
              {data?.groups.length ? (
                data.groups.map((g) => (
                  <GroupTable
                    key={g.id}
                    group={g}
                    edit={groupEdits[g.id] ?? { name: g.name, color: g.color }}
                    onGroupChange={(edit) => setGroupEdits((prev) => ({ ...prev, [g.id]: edit }))}
                    nicknames={nicknames}
                    onNicknameChange={(key, value) => setNicknames((prev) => ({ ...prev, [key]: value }))}
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
