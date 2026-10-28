export type CampusView="3d"|"2d";
const KEY="i-swear-campus-view";
let ephemeral:CampusView|undefined;
export function campusView():CampusView {if(ephemeral)return ephemeral;try{return localStorage.getItem(KEY)==="2d"?"2d":"3d";}catch{return "3d";}}
export function setCampusView(view:CampusView){ephemeral=view;try{localStorage.setItem(KEY,view);}catch{/* The session preference still works. */}window.dispatchEvent(new CustomEvent("campus-view",{detail:view}));}
export function onCampusView(listener:()=>void){const storage=()=>{ephemeral=undefined;listener();};window.addEventListener("campus-view",listener);window.addEventListener("storage",storage);return ()=>{window.removeEventListener("campus-view",listener);window.removeEventListener("storage",storage);};}
