# 🍻 BarCamp Orders

A tiny shared ordering board for a bar camp: everyone adds what they want,
the bar runner sees what needs ordering, who ordered it, and how many items
are still missing.

No dependencies. Node 18+ is all you need.

```bash
npm start            # http://localhost:3000
PORT=8080 npm start  # different port
```

Open the URL on every phone/laptop in the room; the board polls every 3 s so
everyone sees the same state.

## Features

- **Add your order** – name (remembered on your device), item (quick chips + autocomplete), quantity, note.
- **What to order** – items grouped with remaining / ordered / delivered counts, who ordered how many, and one-click "+1 delivered" / "All delivered".
- **By person** – every person's orders, with what's still coming.
- **All orders** – chronological log with per-order delivered ticks, quantity +/-, undo and delete.
- **Requests** – "✋ Special request" opens a modal for things that aren't on the menu ("can someone bring a bottle opener", "table 4 needs napkins"). Requests show up in their own tab with done-toggle and delete, plus a count badge in the header.
- **Menu** – quick chips are grouped by category with prices (from `/api/menu`); "📄 Menu (PDF)" opens a printable menu generated on the fly, no PDF library involved.
- Header stats: to order, ordered, delivered, people, open requests. "Hide delivered" filter. "New round" clears the board (orders and requests).
- A few easter eggs are hidden on the board. Try the Konami code, order 42 of something, click the 🍻 five times…

## API

| Method | Path               | Body                                                     |
|--------|--------------------|----------------------------------------------------------|
| GET    | `/api/state`       | –                                                        |
| POST   | `/api/orders`      | `{ name, item, qty, note }`                              |
| PATCH  | `/api/orders/:id`  | `{ qty?, delivered?, deliverDelta?, done?, note?, … }`   |
| DELETE | `/api/orders/:id`  | –                                                        |
| DELETE | `/api/orders`      | clears everything (orders and requests)                  |
| POST   | `/api/requests`    | `{ name, text }` (text max 300 chars)                    |
| PATCH  | `/api/requests/:id`| `{ done: true\|false, text? }`                            |
| DELETE | `/api/requests/:id`| –                                                        |
| GET    | `/api/menu`        | – → `{ currency, menu: [{ category, items: [{ name, price }] }] }` |
| GET    | `/api/menu.pdf`    | – → the menu as a PDF (`application/pdf`, inline)        |

`GET /api/state` returns `{ orders, requests, serverTime }`. State is persisted to `data/orders.json`
(files written before requests existed are loaded as-is; `requests` defaults to `[]`).
