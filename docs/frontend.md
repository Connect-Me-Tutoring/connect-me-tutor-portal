# Frontend

## Custom Tailwind Color Scheme

The app defines a custom Connect Me brand palette in `tailwind.config.ts` under `theme.extend.colors`. These are available as standard Tailwind utility classes (e.g. `bg-connect-me-blue-3`, `text-connect-me-gray-2`, `border-connect-me-black`).

### Brand blues (light → dark)

| Class               | Hex       |
| ------------------- | --------- |
| `connect-me-blue-1` | `#B7E2F2` |
| `connect-me-blue-2` | `#6AB2D7` |
| `connect-me-blue-3` | `#0E5B94` |
| `connect-me-blue-4` | `#104A75` |
| `connect-me-blue-5` | `#0B3967` |

### Grays & black

| Class               | Hex       |
| ------------------- | --------- |
| `connect-me-gray-1` | `#8494A8` |
| `connect-me-gray-2` | `#495860` |
| `connect-me-gray-3` | `#30302F` |
| `connect-me-black`  | `#040405` |

### Semantic / theme colors

In addition to the brand palette, the config maps the standard shadcn/ui semantic tokens
(`background`, `foreground`, `primary`, `secondary`, `destructive`, `muted`, `accent`,
`popover`, `card`, and the `sidebar-*` set) to CSS variables (`hsl(var(--...))`). These
drive light/dark theming (`darkMode: ["class"]`) and should be preferred for general UI
chrome, while the `connect-me-*` palette is used for brand-specific accents.
