# UI & Design: Use shadcn/ui

Whenever you work on design or UI, build with shadcn/ui components rather than hand-rolling your own.

- **Reuse what's already installed.** Check `components/ui/` first (button, card, dialog, dropdown-menu, form, input, select, sheet, sidebar, table, tabs, toast, tooltip, etc.) and compose from those.
- **Add missing components with the CLI**, e.g. `npx shadcn@latest add accordion`. Config lives in `components.json` (default style, neutral base color, CSS variables, aliases `@/components` and `@/lib/utils`).
- **Don't fork primitives for one-off tweaks.** Customize via `className` and `cn()` from `@/lib/utils`, or add a variant to the component, instead of copying it or building a new one from scratch.
- **Use the custom Connect Me colors whenever possible.** `tailwind.config.ts` defines the brand palette. Reach for these first for brand color, accents, and text (e.g. `bg-connect-me-blue-3`, `text-connect-me-gray-2`, `hover:bg-connect-me-blue-4`):
  - Blues, light → dark: `connect-me-blue-1` `#B7E2F2`, `connect-me-blue-2` `#6AB2D7`, `connect-me-blue-3` `#0E5B94`, `connect-me-blue-4` `#104A75`, `connect-me-blue-5` `#0B3967`
  - Grays, light → dark: `connect-me-gray-1` `#8494A8`, `connect-me-gray-2` `#495860`, `connect-me-gray-3` `#30302F`
  - `connect-me-black` `#040405`
- **Fall back to shadcn theme tokens for everything else.** For surfaces, borders, and states the brand palette doesn't cover, use `bg-background`, `text-muted-foreground`, `border-border`, `bg-destructive`, etc. (CSS variables in `app/globals.css`). Never hardcode hex/rgb values or use arbitrary color classes like `bg-[#0E5B94]`. If a brand color is missing, add it to `tailwind.config.ts`.
- **Forms** use the shadcn `Form` components (react-hook-form); **notifications** use the existing `toast` / `use-toast`.
- Keep shadcn's accessibility behavior intact (Radix primitives, labels, focus states); don't swap them for plain `div`s.
