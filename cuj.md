### Snapshot current tab groups
- User Click the extension button, a dropdown menu pops out with
  - First menu item of a input and a button (round icon button inside of input, can be triggered by enter)
    - input is the current snapshot's name, can be empty, default name is "MM/DD/YYYY" Groups (also the placeholder)
    - button is for **saving** the current tab groups with the specified name, on **saving**, the input auto clears
  - If there are saved snapshots with user defined names, show them as other menu items, on clicking these menu items,
  call chrome API to override all the saved tab groups with the tab group associated with that snapshot.
  when overriding, if there are tab groups opened, **update** that tab group to make it the same as the snapshots.

### Snapshot Rules
Snapshot in the context is the snapshot for a simplified expression of all chrome tabs. Simplified means while chrome may use tab ID
to preserve the state of each tabs in a group like history, the snapshot doesn't keep that information, snapshot only care about the
URL of each tab and other metadata (defined in the data structure).

**save** rule:
- for tabs with the same url, only save as one tab

**update** rule:
- do not close any tabs in existing tab group
- if there are tabs in snapshots that doesn't exist in the current tab group, open it by URL and add to the current groups

### Name snapshots and manage snapshots
User opens options page, there is a list of all snapshots.
For each snapshot, there is a update button and a delete button
**update** button opens a dialog, which contains the snapshot's name in a input, several tables of grouped tab pages. Currently only the snapshot name can be changed.
