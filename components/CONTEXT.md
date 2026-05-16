# components/ — Context

## What This Folder Does

Shared React components used across multiple pages.

---

## Files

### `Navbar.js`
Global navigation bar rendered in `app/layout.js`.
Links to: Home, Faith Declarations, Study Series.

---

## Conventions

- All components are JavaScript (`.js`), not TypeScript
- Styling uses Tailwind CSS utility classes
- shadcn/ui components (from `@/components/ui/`) are auto-generated via CLI and live in `components/ui/` — do not manually edit those files
- Custom components (like `Navbar.js`) live directly in `components/`
- Use `cn()` from `@/lib/utils` for conditional class merging
