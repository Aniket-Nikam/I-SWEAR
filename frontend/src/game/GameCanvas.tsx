import { lazy, Suspense, useState } from "react";
import type { WorldProps } from "./CampusCanvas";

const Campus = lazy(() => import("./CampusCanvas").then(module => ({default:module.CampusCanvas})));
const Flat = lazy(() => import("./FlatGameCanvas").then(module => ({default:module.GameCanvas})));

export function GameCanvas(props:WorldProps) {
  const [unavailable,setUnavailable]=useState(false);
  const campus=(props.snapshot.room.map_id??"campus")==="campus";
  return <Suspense fallback={<div className="loading-screen">Opening the facility</div>}>
    {campus&&unavailable&&<p className="graphics-notice" role="status">3D is unavailable on this device. Illustrated view is active.</p>}
    {campus&&!unavailable
      ? <Campus {...props} onFailure={()=>setUnavailable(true)} />
      : <Flat {...props} />}
  </Suspense>;
}
