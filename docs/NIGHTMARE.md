# Nightmare mode — The Unsaid

Nightmare is an optional room rule, selected when hosting or starting a solo case. The menu labels strong jump scares and creature devouring before entry. Turn the checkbox off for a calm mystery. Guided training always remains calm. Existing API clients default to calm unless they send `horror: true`.

## What provokes it

A human explicitly marking a reconstruction position **CONFIRMED** can awaken The Unsaid when that claim contradicts a physical record the group has already recovered. A majority vote to record a first theory can do the same. Ordinary unconfirmed guesses and automatic checkpoints do not provoke it. The warning names the position, claimed fact, recorded fact and source. Open Reconstruction and correct/link the physical record, or clear the offending position.

The server compares public sources only. It does not inspect secret truth, unrecovered evidence, memory accuracy flags, or the correct timeline order during an investigation. A retracted testimony is resolved again before deciding whether pursuit continues.

## Warning, hunt and capture

- Nine seconds to correct the claim before the creature arrives.
- Twenty seconds of pursuit if the mistake remains. Witnesses can outrun it: 230 versus 180 world units per second.
- Correcting or clearing the claim during pursuit makes it retreat. Other witnesses can help on the shared board.
- Contact causes a 3.6-second devour scene for the marked witness. That witness freezes; the others continue investigating. The captured witness then returns at their clear entrance spawn.
- Forty-second cooldown after retreat or capture. The same event/fact/value mistake cannot repeatedly trigger it in one case.
- Disconnecting the marked witness cancels the hunt when the room continues. Captures survive checkpoints and reconnects. Rematch clears encounter state and keeps the selected mode.

The creature follows the same collision layout on all three maps. Route computation runs off the simulation loop, with one pending task per active encounter and no more than one new route per second. Rendering interpolates server-owned positions. No new physics engine, renderer, textures or network service is needed.

## The final story

Voting to lock a false final reconstruction causes a shared devour ending before the truth reveal. Missing fields alone do not count as false claims. A deadline closes the case as **unsealed**, without forcing that ending. Nightmare solo partners cannot seal the final story without the human's vote. Scoring remains the existing reconstruction score; horror does not secretly change confidence or reality recovery.

## Sound, motion and preview

Settings → Display → **Cinematic scares** controls the face lunge and attack roar, while leaving the room's pursuit rules intact. **Reduce motion** removes the lunge and head movement. Master mute and effect volume still apply. Warning and capture always have readable text.

**Preview creature encounter** shows the same original 3D paper-mask creature in a clearly labelled local preview. It records no capture and closes with its button or Escape. The case clock continues. The preview uses the current world context; calm cases allocate the face only when explicitly previewed. Desktop and phone preview screenshots are presentation examples, not evidence of an actual capture.

Creature sounds are Darsycho's CC0 *Monster snarls*, with source hashes and edits in the shipped audio credits. They load only in Nightmare or an explicit preview. Danger lowers the score to 15% of its selected level and respects stronger audio controls. The original code-authored monster has five opaque mesh draws and no texture assets.

## Reproduce verification

Run the normal backend and client suites, then `python backend/scripts/smoke_horror.py --url http://127.0.0.1:8026 --clients 8 --map campus` against an isolated running server. The acceptance script uses public HTTP/WebSocket actions and collision-safe movement, with acknowledgement between testimony selections. It exercises warning cancellation, actual pursuit/contact, target freeze, another player moving, respawn, reconnect, final devour, persisted replay and rematch. Unit fixtures separately check all three maps, privacy, deadline behavior and calm/training exclusions. See QA.md for measured results and limitations.
