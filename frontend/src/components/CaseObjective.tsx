import type { MapInfo } from "../types/protocol";

const INCIDENTS:Record<MapInfo["id"],{title:string;incident:string}>={
 campus:{title:"Trace the research container.",incident:"A research container was moved during the blackout. Witnesses remember different routes."},
 observatory:{title:"Rebuild the observatory transfer.",incident:"An item changed rooms while the observatory’s camera and power systems were altered."},
 ferry:{title:"Trace the ferry cargo.",incident:"Cargo changed rooms during the final ferry transfer. The dock records and memories disagree."},
};

/** Public premise only: never infer the answer from hidden or unrecovered facts. */
export function CaseObjective({mapId="campus"}:{mapId?:MapInfo["id"]}){
 const incident=INCIDENTS[mapId];
 return <section className="case-objective" aria-label="What you are solving">
  <h3 tabIndex={-1}>{incident.title}</h3><p>{incident.incident}</p>
  <p><b>You and the other players must answer:</b></p>
  <ul><li>Who moved what?</li><li>Where did it go, and when?</li><li>What happened before and after the transfer?</li></ul>
  <div className="objective-finish"><b>Your final answer is six events in time order.</b><p>On Reconstruction, arrange six events from earliest to latest. Link records to fill in who, what, where and when. Submit your answer together. The ending checks its accuracy; aim for 100%.</p></div>
  <details className="objective-example"><summary>Show me a simple example</summary><p>A witness remembers “21:10, Workshop.” A door log records “21:10, Store room.” Use <b>Store room</b> in your answer. That is an example, not a clue for this case.</p></details>
 </section>;
}
