Snapshot
- `id` string
- `name` string
- `create_time`

TabGroup
- `id` string
- `snapshot_id` string
- `name` string (same as the tab group name in chrome; editable in the options page)
- `color` string (chrome tab group color: grey, blue, red, yellow, green, pink, purple, cyan, orange; editable in the options page)
- `collapsed` boolean

Tab
- `tab_group_id` string
- `URL` string
- `nickname` string (empty by default; if set, replaces the page title when the snapshot is restored)

