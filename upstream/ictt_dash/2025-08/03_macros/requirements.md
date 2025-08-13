# Macros Tracker (Vite + React + TS + Tailwind, localStorage)

Small web app to track protein/carbs/fat (and fiber) and approximate calories.
Built with Vite, React, TypeScript, and Tailwind. No backend, no auth. Data
persisted in `localStorage` in the browser. UI copy must be in Russian.

### TL;DR

- **Stack**: Vite, React 18, TypeScript, TailwindCSS.
- **Storage**: Browser `localStorage` (single key) with `products` and current
  `plate`.
- **Calories**: `kcal = 4*protein + 9*fat + 4*(carbs - fiber)` (net carbs).
- **UX**: Select or add products. If per-100g → input grams (label `gr`). If
  per-portion → input number of portions (label `serv.`). Running totals at
  bottom.

### Constraints & decisions

- SPA with React + TS via Vite.
- Tailwind built with PostCSS (standard Vite/Tailwind setup).
- No backend; no authentication.
- Data is per-browser (scoped to the device/profile) via `localStorage`.
- All visible UI strings are in Russian.

### User stories

- See list of previously added products. Edit or delete any product.
- Add a product with: name, protein, fat, carbs, fiber, and mode: per-100g or
  per-portion.
  - If per-portion: optional `portionLabel` (e.g., "slice") and
    `portionSizeGrams` (informational only).
- Build a "plate": pick products and enter grams or portions accordingly.
- See totals of protein/fat/carbs/fiber and approximate kcal.
- Current plate is persisted between sessions in `localStorage`.
- No meal history in v1.

### Data model (localStorage)

- Key: `macrosTracker.v1`
- Shape:

```json
{
  "products": [
    {
      "id": "uuid",
      "name": "String",
      "mode": "per100g" | "perPortion",
      "macros": { "protein": Number, "fat": Number, "carbs": Number, "fiber": Number },
      "portionLabel": "String (optional)",
      "portionSizeGrams": Number (optional),
      "createdAt": "iso_string",
      "updatedAt": "iso_string"
    }
  ],
  "plate": [
    {
      "id": "uuid",
      "productId": "uuid",
      "amount": Number
    }
  ],
  "createdAt": "iso_string",
  "updatedAt": "iso_string"
}
```

Notes:

- `products` is a small array. Edits are read-modify-write on the object and
  saved back to `localStorage`.
- `plate` (current plate) is also saved in `localStorage` and loaded on app
  start.

### Calculations

- per-100g: scale by `grams / 100`.
- per-portion: scale by `portions`.
- Totals: sum of scaled protein, fat, carbs, fiber.
- Calories: `4*P + 9*F + 4*(C - fiber)` (net carbs). A toggle for label calories
  can be added later.

### UI layout (Tailwind)

- Header: title and simple actions (no auth).
- Two columns on desktop (stack on mobile):
  - Products: list + add/edit/delete form (modal or inline).
  - Calculator: selector + input (grams/portions). Show unit label near input:
    `gr` for per-100g, `serv.` for per-portion. Current plate list with remove,
    sticky totals at bottom.

### Persistence setup

- Use `localStorage.getItem('macrosTracker.v1')` / `setItem(...)`.
- Parse/serialize JSON; handle corrupt/missing data by falling back to defaults.
- Use `crypto.randomUUID()` for `id` values.
- Timestamps as ISO strings via `new Date().toISOString()`.

### Implementation plan

1. Scaffold
   - Vite React TS app; Tailwind configured (PostCSS, `tailwind.config.js`).
   - `index.html` with root; `src/main.tsx` renders `<App />`.
2. State & persistence
   - In `App`, load initial state from `localStorage` on mount; keep it in React
     state; save on every meaningful change (debounced or immediate; start with
     immediate for simplicity).
   - Define types for `Product`, `Macros`, `PlateItem`, `AppState`.
3. Products CRUD
   - Add/edit form: name, macros, fiber, mode; optional portion label/size.
   - List with edit/delete; confirm before delete.
4. Calculator
   - Product selector; input switches between grams (label `gr`) and portions
     (label `serv.`) by product mode.
   - Plate list persisted in `localStorage`; recompute totals on change; clear
     plate.
5. Polish
   - Validate non-negative numbers and required fields.
   - Number formatting (1–2 decimals); minimal empty states.

### Build/runtime

- Dev: `pnpm dev` (or `npm run dev`, `yarn dev`).
- Build: `pnpm build` → static assets in `dist/`.
- No external CDNs required at runtime; everything bundled by Vite.

### Non-goals (v1)

- Food databases/barcodes
- Day-by-day history
- Extra nutrition fields beyond P/F/C/Fiber
- Sync across devices/browsers

### Risks / trade-offs

- `localStorage` is device/browser-scoped; no multi-device sync.
- Large datasets are not optimized; fine for a small personal list.

### Deliverables

- Working Vite app with React + TS + Tailwind.
- `requirements.md` (this).

### Next

- Implement React components and persistence to `localStorage`.
