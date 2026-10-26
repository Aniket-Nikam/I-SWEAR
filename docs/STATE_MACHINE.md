# State Machine

```text
NO SESSION
  -> create room or join room

LOBBY
  -> connect or reconnect
  -> toggle ready
  -> host migration on host disconnect
  -> start when 4-8 players are all ready

EXPLORING
  -> movement input
  -> authoritative position broadcast
  -> proximity interaction
  -> reconnect to same player identity
```

EXPLORING also accepts private-memory testimony, public responses, evidence recovery, and revision-checked timeline edits. Editing clears lock votes.

```text
EXPLORING
  -> six slots filled + three physical records + majority vote
REVEAL (26 seconds)
  -> movement and record mutations frozen
  -> six canonical comparisons and room highlights
RESULTS
  -> deterministic confidence, challenge, evidence, propagation, and timeline metrics
  -> host rematch
LOBBY (new round, old state cleared)
```

Solo mode creates three explicitly labelled scripted witnesses. It uses the same movement, collision, badge access, evidence, testimony, timeline, and scoring systems. A script supplies waypoints and timed decisions, never an LLM agent.
