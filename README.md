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
- Header stats: to order, ordered, delivered, people. "Hide delivered" filter. "New round" clears the board.

## API

| Method | Path               | Body                                                     |
|--------|--------------------|----------------------------------------------------------|
| GET    | `/api/state`       | –                                                        |
| POST   | `/api/orders`      | `{ name, item, qty, note }`                              |
| PATCH  | `/api/orders/:id`  | `{ qty?, delivered?, deliverDelta?, done?, note?, … }`   |
| DELETE | `/api/orders/:id`  | –                                                        |
| DELETE | `/api/orders`      | clears everything                                        |

State is persisted to `data/orders.json`.
