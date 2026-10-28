import { lazy, Suspense, useState, useSyncExternalStore } from "react";
import type { WorldProps } from "./CampusCanvas";
import { campusView, onCampusView } from "./rendererPreference";

const Campus = lazy(() => import("./CampusCanvas").then(module => ({default:module.CampusCanvas})));
const Flat = lazy(() => import("./FlatGameCanvas").then(module => ({default:module.GameCanvas})));

export function GameCanvas(props:WorldProps) {
  const view=useSyncExternalStore(onCampusView,campusView),[unavailable,setUnavailable]=useState(false);
  const campus=(props.snapshot.room.map_id??"campus")==="campus";
  return <Suspense fallback={<div className="loading-screen">Opening the facility</div>}>
    {campus&&view==="3d"&&unavailable&&<p className="graphics-notice" role="status">3D is unavailable on this device. Illustrated view is active.</p>}
    {campus&&view==="3d"&&!unavailable
      ? <Campus {...props} onFailure={()=>setUnavailable(true)} />
      : <Flat {...props} />}
  </Suspense>;
}
