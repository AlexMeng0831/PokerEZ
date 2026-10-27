# PokerEZ engine house rules

PokerEZ v1 is a casual table with integer play chips. Its reference rules are [PokerStars' standard poker rules](https://www.pokerstars.com/help/articles/poker-rules-master/229151/) and [Poker TDA 2026, version 1.1 (September 21)](https://www.pokertda.com/view-poker-tda-rules/). TDA is a tournament ruleset; PokerEZ implements the following explicit casual-table choices rather than claiming complete TDA tournament compliance.

## Table and button

- Two to six funded, ready players; six physical seats numbered 0–5 clockwise. Player identity is independent of seat and display name.
- Fixed blinds, default 5/10; default starting stack 1,000. All amounts and the entire table total must be nonnegative safe integers. A posted blind is capped by the player's stack.
- The first button is the lowest eligible seat. Thereafter the button moves clockwise past empty, sitting-out and unfunded seats. This differs from TDA's tournament **dead button**.
- Heads-up: button posts SB, receives the last private card, acts first preflop and last postflop. On entering heads-up, adjust the button if needed so the surviving previous BB does not pay BB twice consecutively.
- Joining, leaving, sitting out/returning, and topping up are accepted only in `WAITING` or `FINISHED`. New/returning players enter the next eligible hand. There is **no missed-blind debt** or blind-posting requirement on return.

## Bets and action

- `BET.to` and `RAISE_TO.to` are the player's cumulative target for the current street. `CALL` and `ALL_IN` take no amount; the engine computes it.
- Minimum opening bet is BB. The next full raise adds the last full increment to the current bet; a short all-in never shrinks that increment. A short opening all-in can be raised by an unacted player by at least BB more, not merely completed to BB.
- Raise rights are per player. After acting, the player needs to face a full increment to raise again. Cumulative short all-ins can cross this threshold for an earlier bettor while leaving a later caller closed. A prior check also counts as an action; a sub-BB opener alone does not reopen that checker.
- Preflop uses the nominal BB bring-in while two or more funded players can still act, even if the BB posted short. Once only one funded player remains, that player only needs to answer the actual live all-in amount and cannot bet into a dry side pot.
- A fold in turn is accepted even when checking was available; there is no tournament penalty system. Posted blinds do not count as a voluntary action: an unraised BB retains an option to check or raise.
- This API requires explicit, valid integer targets. It rejects underraises except exact stack-limited all-ins. Physical-chip, verbal-declaration and 50%-correction procedures do not apply to this command protocol.

## Cards and settlement

- Deal two rounds of private cards, starting left of the button. Burn exactly one card before each of flop (3), turn (1), and river (1).
- End immediately when one live hand remains; do not deal unused community cards or force the winner to show. Otherwise, when calls are resolved and further effective betting is impossible, reveal live hands and run out one board.
- At ordinary showdown, reveal every non-folded hand together. This replaces selective show/muck ordering. Folded cards stay private to their owner.
- Return each street's unique unmatched upper contribution before closing the round. This includes unmatched blind chips and does not depend on hand strength.
- Build each pot from contribution levels. Folded chips remain in the pot; folded players are never eligible to win. Evaluate each main/side pot independently.
- Split ties evenly in whole chips. For each pot independently, distribute remaining chips one at a time to tied winners clockwise from the seat immediately left of the button. Suits never break a hand-strength tie.
- Settlement is atomic and occurs once. The result archives contributions and payouts; live contributions are cleared to prevent double counting or repeated awards.

No ante, straddle, rake, tournament levels, run-it-twice, insurance or real-money accounting is implemented.

## References

TDA rules 17, 21, 23, 36-C, 45 and 49 inform runout disclosure, odd chips, separate pot settlement, heads-up, raises and reopening. The TDA [short opening all-in discussion](https://www.pokertda.com/forum/index.php?topic=663.0) explains why a prior checker needs a full bet before reopening. The choices above explicitly replace tournament-specific procedures where noted.

TDA rules used by permission of the Poker TDA, Copyright 2026, [PokerTDA.com](http://www.pokertda.com), All rights reserved.
