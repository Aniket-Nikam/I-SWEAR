import type { GameResult } from "../types/protocol";
import { WitnessAvatar } from "./WitnessAvatar";

const POINTS = [[70, 48], [300, 48], [530, 48], [530, 145], [300, 145], [70, 145]];

/** Six chronological stations, deliberately a sequence rather than a literal map. */
export function CaseReplay({ result, step }: { result: GameResult; step: number }) {
  const actors = [...new Set(result.comparisons.map(item => item.event.actor))];
  return <div className="case-replay" aria-label={`Incident sequence, moment ${step + 1} of six`}>
    <p>THE RECOVERED SEQUENCE / FOLLOW THE WITNESSES</p>
    <svg viewBox="0 0 600 190" role="img" aria-label="Six moments connected in chronological order">
      <path d="M70 48H530V145H70" />
      {result.comparisons.map(({ event }, index) => <g key={event.id} className={`moment ${index === step ? "active" : ""}`} transform={`translate(${POINTS[index][0]},${POINTS[index][1]})`}>
        <circle r="20" /><text className="moment-number" y="6">{String(index + 1).padStart(2, "0")}</text>
        <text y="34">{event.time} / {event.location}</text>
      </g>)}
      {actors.map((actor, index) => {
        let latest = -1;
        for (let moment = 0; moment <= step; moment++) if (result.comparisons[moment].event.actor === actor) latest = moment;
        if (latest < 0) return null;
        const [x, y] = POINTS[latest];
        return <g key={actor} className="replay-token" style={{ transform: `translate(${x - 19 + index * 9}px,${y - 57}px)` }}>
          <title>{actor}</title><foreignObject width="38" height="52"><WitnessAvatar color={index} /></foreignObject>
        </g>;
      })}
    </svg>
  </div>;
}
