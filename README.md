# PokerEZ

A clean, beginner-friendly Texas Hold’em interface for playing with friends and learning the game. This repository currently contains the **frontend and a mock-event animation preview**. The poker engine is the next phase.

## Current features

- **Play** — create a configurable demo room or join with a six-character code.
- **Poker Table** — responsive seats, cards, chip stacks, pot, and local action feedback.
- **Learn** — rules, ten hand rankings, betting basics, and game flow.
- **Profile** — clearly labeled sample statistics and history, with a locally editable display name.
- **Animation preview** — dealing, betting, collecting chips, community-card reveals, side-pot splits, folds, showdown, and winner highlighting.
- Light/dark themes, portrait mobile layouts, keyboard controls, and Reduced Motion support.

Room codes do not connect players. There is currently **no poker rules engine, authentication, multiplayer server, database, real-money functionality, or ML**. Profile history and animation outcomes are demo data.

## Stack

Next.js App Router · React · TypeScript · Tailwind CSS v4 · Radix/shadcn-style UI primitives · Zustand · next-themes · Motion for React

## Local development

Use Node.js 24 for the current setup and native TypeScript test command.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables, accounts, or external services are needed.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production application |
| `npm start` | Serve the production build |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run the mock-event state tests |

## Routes

| Route | Page |
| --- | --- |
| `/` | Play lobby |
| `/table` | Interactive Motion table rehearsal |
| `/learn` | Rules, hand rankings, and basics |
| `/profile` | Guest profile and labeled demo statistics |
| `/preview` | Motion animation lab and focused table experience |

Display name, theme preference, and demo room metadata are saved in this browser. Table and preview state reset on reload.

## Interactive table

Choose **Try a hand** on the lobby, then **Deal me in**. Call or raise pre-flop, check or bet through the board, or fold and watch the remaining cards. The table focuses automatically; Exit focus / Esc restores the page. Bet sizes use small presets and a slider. Best-hand labels stay beside the player, folded cards stay dimmed, and each completed hand can be replayed with fresh stacks.

This is a branching UI rehearsal with fixed cards, scripted calls, and authored winners, not a poker rules engine. It always uses three sample seats; room settings are saved metadata for future engine integration. The separate `/preview` lab still demonstrates side-pot animations and all event types.

## Animation preview

Open `/preview` or the desktop header’s **Animation preview** link. Play a full ten-chapter sequence, advance one chapter at a time, change speed, or reset during playback.

- **Focused table:** Play/Next opens a viewport-sized view containing the table and controls. Page scrolling is locked while it is open; **Exit focus** or **Esc** restores scrolling and keyboard focus.
- **Continuous dealing:** Hole cards travel from the deck to DOM seat anchors at 260ms per flight, without an added pause between recipients.
- **Best-hand hints:** The hand label sits directly in the player’s seat card. Relevant private/community cards receive an outline without being raised. Click a visible seat to inspect its hand.
- **Folded hands:** Cards remain visible and dimmed in the inspection fixture, with a **FOLDED** marker. Card visibility is controlled by the event producer; folding does not reveal private cards by default.
- **Side pots:** The total separates into main/side allocations in the same position, without a duplicated total underneath.
- **Reduced Motion:** Follows the OS preference, with a manual preview toggle. Travel and 3D flips become short fades; numeric values update directly.

The example progresses from **Pair · Queens** to **Three of a kind · Queens**. These labels, side pots, and the winner are supplied by mock events. The fixture includes an illustrative late fold and does not enforce betting legality.

## Project structure

```text
src/app/                         Pages, shared layout, and styles
src/components/ui/               Buttons and accessible Radix dialog
src/components/poker/            Cards and original table components
src/components/poker/animation/  Motion components, anchors, playback, and focus view
src/components/                  Shared header and theme provider
src/lib/store.ts                 Persisted local Zustand state
src/lib/demo.ts                  Learning examples
src/lib/animation/mock-game.ts   Typed events, presentation state, and mock fixture
tests/animation-events.test.mjs  State and fixture validation
```

`components.json` contains the shadcn aliases and configuration.

Reusable animation pieces include `DomAnchorProvider`, `DomAnchor`, `DealFlightLayer`, `FlipCard`, `AnimatedAmount`, `BetChips`, `PotDisplay`, `SidePotLabels`, `AnimationTable`, `TableFocusFrame`, and `AnimatedButton`.

## Event contract for the engine phase

`GameEvent` in `src/lib/animation/mock-game.ts` is the current presentation contract. `useMockPlayback` exposes `playEvents(events)` so an adapter can await ordered batches through the same animation pipeline.

- `action.amount` means **additional chips committed**, not a total raise-to value.
- `hand-hints` supplies `{ label, detail, madeCards }` for each seat. Stable rank+suit identifiers, such as `Q♥`, connect hints to card highlights.
- `side-pots` supplies allocation amounts and eligible seats.
- `showdown` supplies the winner. The UI does not evaluate hands or decide winners.
- `fold.reveal` is optional and explicit; the mock fixture enables it for inspection.
- Await each event batch before submitting the next. Play/Next are locked while a batch is active.
- `reset()` aborts scheduled playback, clears flights, and restores the initial state. Unmount cancels in-flight work.

The next phase can introduce a separately tested poker engine and map its output to these events. The existing UI can then consume validated outcomes rather than mock outcomes. Backend and multiplayer remain separate work.

## Validation

The current frontend has been checked with production builds, TypeScript, and browser testing on desktop and portrait mobile sizes, including focus/scroll behavior and Reduced Motion.

`npm test` covers chip conservation, nonnegative stacks, unique fixture cards, reset/immutability, hand-highlight references, and producer-controlled card visibility.
