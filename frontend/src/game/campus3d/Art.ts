import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Interactable, RoomSnapshot } from "../../types/protocol";

export const INK = 0x152c33, PAPER = 0xf2e4c8, SAGE = 0xb2ceba, CORAL = 0xef805f;
type Form = "box" | "cylinder" | "sphere";
interface Part { form: Form; x: number; y: number; z: number; w: number; h: number; d: number; color: number; turn: number; pitch:number }

/** Static furniture and architecture become three instanced draws and one ink pass. */
class Illustration {
  parts: Part[] = [];
  edges: number[] = [];
  add(form: Form, x: number, y: number, z: number, w: number, h: number, d: number, color: number, ink = false, turn = 0, pitch=0) {
    this.parts.push({ form, x, y, z, w, h, d, color, turn, pitch });
    if (ink && form === "box") {
      const points = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
      const c = Math.cos(turn), s = Math.sin(turn);
      const corners = points.map(([a,b,c0]) => { const px = a*w/2, pz = c0*d/2; return [x+px*c+pz*s,y+b*h/2,z+pz*c-px*s]; });
      for (const [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) this.edges.push(...corners[a],...corners[b]);
    }
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, ink = false, turn = 0) { this.add("box",x,y,z,w,h,d,color,ink,turn); }
  cylinder(x: number, y: number, z: number, w: number, h: number, d: number, color: number) { this.add("cylinder",x,y,z,w,h,d,color); }
  leaf(x: number, y: number, z: number, w: number, h: number, color: number) { this.add("sphere",x,y,z,w,h,w*.65,color); }
  finish(scene: T.Scene) {
    const matrix = new T.Object3D(), color = new T.Color();
    for (const form of ["box","cylinder","sphere"] as const) {
      const parts = this.parts.filter(part => part.form === form);
      if (!parts.length) continue;
      const geometry = form === "box" ? new T.BoxGeometry(1,1,1) : form === "cylinder" ? new T.CylinderGeometry(.5,.5,1,10) : new T.SphereGeometry(.5,8,6);
      const mesh = new T.InstancedMesh(geometry,new T.MeshLambertMaterial({ color:0xffffff, flatShading:true }),parts.length);
      parts.forEach((part,index) => {
        matrix.position.set(part.x,part.y,part.z); matrix.scale.set(part.w,part.h,part.d); matrix.rotation.set(part.pitch,part.turn,0); matrix.updateMatrix();
        mesh.setMatrixAt(index,matrix.matrix); mesh.setColorAt(index,color.setHex(part.color));
      });
      mesh.computeBoundingSphere(); scene.add(mesh);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute("position",new T.Float32BufferAttribute(this.edges,3));
    scene.add(new T.LineSegments(geometry,new T.LineBasicMaterial({color:INK,transparent:true,opacity:.64})));
  }
}

function plant(a: Illustration, x: number, z: number) {
  a.cylinder(x,12,z,27,24,27,0xab7356); a.cylinder(x,25,z,29,5,29,INK);
  a.leaf(x-9,49,z,19,40,0x6f9278); a.leaf(x+10,55,z+3,20,47,0x89a27c); a.leaf(x,67,z-5,17,43,0xa2b58a);
}
function bench(a: Illustration, x: number, z: number, width = 110) {
  for (const dx of [-width*.37,width*.37]) a.box(x+dx,14,z,9,28,28,INK);
  a.box(x,31,z,width,10,36,0xb78d60,true); a.box(x,52,z-17,width,30,7,0xb78d60,true);
  for(const dz of [-11,0,11])a.box(x,36.2,z+dz,width-5,.5,1,0x745c48);
  for(const y of [45,56])a.box(x,y,z-12.9,width-6,1,1,0xe0bb83);
  for(const dx of [-width*.44,width*.44]){a.box(x+dx,43,z,4,20,4,INK);a.box(x+dx,53,z,6,3,28,INK);}
}
function shelves(a: Illustration, x: number, z: number, width: number, seed: number) {
  a.box(x,55,z,width,110,24,0x425b59,true);
  for (const y of [20,52,84]) {
    a.box(x,y,z+13,width-5,4,28,0xa49670);
    for (let i=0;i<Math.floor(width/19);i++) {
      const colors = [0xc4b38e,0x9faf99,0x9b7970,0x66858b];
      a.box(x-width/2+13+i*19,y+14,z+3,12,23,16,colors[(i+seed)%4],true);
      a.box(x-width/2+13+i*19,y+15,z+12,6,3,1,PAPER);
    }
  }
}
function cabinet(a: Illustration, x: number, z: number, width: number, server = false) {
  a.box(x,49,z,width,98,30,server?0x30474e:0x78827b,true);
  for (const y of [22,48,74]) {
    a.box(x,y,z+16,width-9,22,2,server?0x20363c:0x8b9184,true);
    a.box(x-7,y+3,z+18,12,3,3,server?SAGE:INK);
    if (server) a.box(x+width*.29,y+3,z+18,3,3,3,CORAL);
  }
}

/** Recognizable evidence props are authored meshes, with no external model downloads. */
function evidence(a: Illustration, item: Interactable) {
  const {x,y:z,kind} = item;
  a.cylinder(x,.7,z,67,1,67,0x536d65);
  if (/badge|scanner/.test(kind)) {
    a.box(x,34,z,28,68,19,0x28444a,true); a.box(x,45,z+10,22,22,2,INK,true);
    a.box(x,47,z+12,16,9,1,CORAL); a.box(x,26,z+11,14,3,2,SAGE); a.box(x,5,z,39,10,28,INK,true);
  } else if (/chamber/.test(kind)) {
    a.cylinder(x,9,z,60,18,60,INK);a.cylinder(x,22,z,52,10,52,0xa4b8a4);
    a.cylinder(x,78,z,56,9,56,0xc0c4a6);a.cylinder(x,85,z,28,6,28,INK);
    for(const dx of [-20,20])for(const dz of [-14,14])a.box(x+dx,50,z+dz,4,50,4,SAGE,true);
    a.cylinder(x,40,z,24,24,24,0x617d73);a.box(x,41,z+13,17,14,2,CORAL,true);
  } else if (/glass/.test(kind)) {
    for(let i=0;i<7;i++)a.box(x+Math.sin(i*2.4)*24,5+i%2,z+Math.cos(i*2.4)*20,10+i*2,2,8,0xb9d0c1,true,i*.9);
  } else if (/footprints/.test(kind)) {
    for(let i=0;i<4;i++)a.box(x+(i%2?9:-9),4,z-27+i*18,9,1,17,0x374e49,false,.13);
  } else if (/id_card/.test(kind)) {
    a.box(x,5,z,36,3,24,PAPER,true,.15);a.box(x-8,7,z,9,1,13,0x779487,false,.15);a.box(x+6,7,z,11,1,2,INK,false,.15);
  } else if (/notebook|paper|note|record/.test(kind)) {
    a.box(x,22,z,61,5,44,0x8d7759,true);a.box(x-23,10,z,5,20,29,INK);a.box(x+23,10,z,5,20,29,INK);
    a.box(x,26,z,43,4,32,0x456565,true);a.box(x,29,z,40,2,28,PAPER,true);a.box(x,31,z,2,1,28,CORAL);
    for(let i=0;i<3;i++){a.box(x-10,31,z-8+i*7,12,1,1,0x71837a);a.box(x+10,31,z-8+i*7,12,1,1,0x71837a);}
  } else if (/camera/.test(kind)) {
    a.box(x,36,z,9,72,9,0x6d807c,true); a.box(x,76,z,43,24,22,PAPER,true);
    a.cylinder(x+23,76,z,17,12,17,INK); a.box(x+13,92,z,16,6,16,0x647a70);
  } else if (/power|panel|breaker/.test(kind)) {
    a.box(x,42,z,47,84,22,0x71867b,true); a.box(x,43,z+12,36,65,3,0x324c50,true);
    for (let i=0;i<3;i++) { a.box(x-8+i*8,47,z+15,4,22,6,PAPER,true); a.box(x-8+i*8,55,z+19,5,5,2,i===1?CORAL:SAGE); }
    a.box(x,78,z+14,25,3,2,CORAL);
  } else if (/cabinet|archive|locker/.test(kind)) {
    cabinet(a,x,z,48); a.box(x,99,z,39,2,26,PAPER,true);
  } else if (/terminal|computer|log|console/.test(kind)) {
    a.box(x,22,z,63,7,38,0xb5a380,true); a.box(x,42,z-6,41,31,9,INK,true);
    a.box(x,43,z,32,21,2,0x9cbbad); a.box(x,27,z+11,32,2,11,PAPER,true);
    a.box(x-24,10,z,5,20,6,INK); a.box(x+24,10,z,5,20,6,INK);
  } else {
    a.box(x,19,z,55,37,39,0x768a7b,true); a.box(x,39,z,59,6,42,0xa6b8a0,true);
    a.box(x,22,z+21,18,14,2,PAPER,true); a.box(x,44,z,21,5,12,INK,true);
    if (/notebook|paper|record|note/.test(kind)) { a.box(x+3,48,z,28,3,30,PAPER,true,.13); a.box(x+3,50,z,2,1,25,CORAL,false,.13); }
  }
}

export function buildCampus(scene: T.Scene, snapshot: RoomSnapshot) {
  const a = new Illustration(), {world} = snapshot;
  const theme=snapshot.room?.map_id??"campus",ferry=theme==="ferry",observatory=theme==="observatory";
  if(ferry)a.box(world.width/2,-35,world.height/2,world.width+1200,20,world.height+1200,0x365967);
  a.box(world.width/2,-15,world.height/2,world.width+52,30,world.height+52,INK,true);
  a.box(world.width/2,-1,world.height/2,world.width,4,world.height,ferry?0x756c55:observatory?0x50616b:0x536259);
  const tones = [0x899588,0x9aa28d,0x839a92,0x929d8c];
  world.rooms.forEach((r,index) => {
    const wood = ferry||/Archive|Records|Break|Dispatch|Chart|Workshop/.test(r.name), garden = /Glasshouse/.test(r.name);
    a.box(r.x+r.w/2,0,r.y+r.h/2,r.w,3,r.h,wood?(ferry?0xa48b62:0x9b8464):garden?0x6d8066:observatory?0x697f8a:tones[index%4]);
    // Thin painted seams, not individually shaded tiles: one instanced box draw.
    for (let x=r.x+40;x<r.x+r.w;x+=wood?80:64) a.box(x,2,r.y+r.h/2,1,.5,r.h,wood?0x877557:0x6b7b6c);
    for (let z=r.y+40;z<r.y+r.h;z+=wood?28:64) a.box(r.x+r.w/2,2,z,r.w,.5,1,wood?0x877557:0x6b7b6c);
    // Screen-printed borders and long window-light shapes give each room a
    // composed miniature look. These are flat paint, never invisible solids.
    const trim=ferry?0xc6ae7b:observatory?0xa2b8be:0xc6c5a3;
    for(const side of [18,r.h-18])a.box(r.x+r.w/2,2.5,r.y+side,r.w-36,.5,2,trim);
    for(const side of [18,r.w-18])a.box(r.x+side,2.5,r.y+r.h/2,2,.5,r.h-36,trim);
    if(!wood){
      for(let i=0;i<3;i++)a.box(r.x+r.w*.20+i*22,2.7,r.y+r.h*.28,12,.4,Math.min(120,r.h*.30),observatory?0x839ca3:0xaab49b,false,-.45);
    }
    // Noticeboards, window recesses and ventilation stay against existing
    // walls. No extra collider, texture download or live light is needed.
    if(r.w>300){
      const bx=r.x+78,bz=r.y+5;
      a.box(bx,64,bz,70,42,6,INK,true);
      a.box(bx,64,bz+4,63,35,2,observatory?0x638089:ferry?0x547b80:0x977a57);
      for(let n=0;n<3;n++)a.box(bx-19+n*19,65+(n%2)*4,bz+6,13,23,1,n===1?0xdeb773:PAPER,false,n*.07);
      a.box(bx+105,70,bz,48,24,7,0x334d50,true);
      for(let n=0;n<4;n++)a.box(bx+105,63+n*5,bz+5,39,2,1,0x839c92);
    }
    if(observatory&&/Dome|Rotunda|Telescope|Weather/.test(r.name)){
      const radius=Math.min(r.w,r.h)*.58;
      a.cylinder(r.x+r.w/2,2,r.y+r.h/2,radius,1,radius,0x809992);
      a.cylinder(r.x+r.w/2,3,r.y+r.h/2,radius-8,1,radius-8,0x5e7782);
      a.box(r.x+r.w/2,4,r.y+r.h/2,radius,1,2,0xc9bea0);a.box(r.x+r.w/2,4,r.y+r.h/2,2,1,radius,0xc9bea0);
    }
    // Small warm wall fixtures use emissive-looking paint, with no point-light/shadow cost.
    a.box(r.x+r.w-48,98,r.y+4,37,11,11,INK,true); a.box(r.x+r.w-48,96,r.y+11,29,6,4,0xf1c976);
  });
  for(const [x,z,w,d] of world.walls) {
    const height = z<70 || x<60 ? 108 : 45;
    a.box(x,height/2,z,w,height,d,ferry?0x697267:observatory?0x4a6472:0x45605f,true);
    a.box(x,height+3,z,w+3,6,d+3,0xa8b7a0,true);
    a.box(x,6,z,w+3,12,d+3,INK);
  }
  // The server's public manifest is also the collision and navigation layout.
  for(const f of world.furniture??[]) {
    const {x,y:z,w,kind}=f;
    // Baked contact shapes anchor furniture without shadow maps or a second
    // render pass. Footprints use the same manifest as physics/navigation.
    a.add("cylinder",x+5,2.8,z+6,w+14,.7,f.d+14,observatory?0x465e68:ferry?0x7c684f:0x5a7169);
    if(kind==="plant")plant(a,x,z);
    else if(kind==="bench")bench(a,x,z,w);
    else if(kind==="shelves")shelves(a,x,z,w,f.seed);
    else if(kind==="server_rack")cabinet(a,x,z,w,true);
    else if(kind==="coffee_station"){a.box(x,43,z,w,86,32,0xb59b79,true);a.box(x,70,z+18,44,26,3,INK,true);}
    else if(kind==="telescope"){
      a.cylinder(x,7,z,70,14,70,INK);a.cylinder(x,34,z,15,54,15,0xb9ae87);
      a.add("cylinder",x,68,z,23,100,23,PAPER,false,.65,Math.PI/3);
      a.add("cylinder",x+29,96,z+38,28,14,28,INK,false,.65,Math.PI/3);
      a.add("cylinder",x+33,100,z+43,20,2,20,SAGE,false,.65,Math.PI/3);
      for(const dx of [-24,24])a.box(x+dx,19,z,5,38,8,INK,true,dx>0?-.2:.2);
    }
    else if(kind==="chart_table"){
      a.box(x,30,z,100,8,65,0xa18b64,true);for(const dx of [-39,39])a.box(x+dx,14,z,7,28,52,INK);
      a.box(x,35,z,80,2,48,PAPER,true);for(let i=0;i<5;i++)a.cylinder(x-28+i*14,37,z+Math.sin(i*2)*15,3,1,3,CORAL);
    }
    else if(kind==="navigation_console"){
      a.box(x,25,z,98,50,52,0x617f7e,true);a.box(x,52,z,100,6,61,0xa6b39a,true);
      a.box(x-20,73,z-13,43,35,10,INK,true);a.box(x-20,74,z-7,34,25,2,0x9bbdac);
      a.box(x+24,65,z,32,15,30,INK,true);a.cylinder(x+24,74,z,22,1,22,0x90b9aa);
      for(let i=0;i<4;i++)a.box(x-29+i*11,56,z+17,6,2,7,i===3?CORAL:PAPER);
    }
    else if(kind==="cargo_crate"){
      a.box(x,31,z,90,62,70,0xb49b70,true);for(const dx of [-28,28])a.box(x+dx,32,z,7,65,73,INK,true);
      a.box(x,64,z,92,5,72,0xd0bb8e,true);a.box(x,35,z+37,26,20,2,PAPER,true);
    }
    else if(kind==="boiler"){
      a.cylinder(x,42,z,62,84,62,0x718b89);a.cylinder(x,85,z,66,6,66,INK);
      a.box(x,45,z+31,24,24,4,INK,true);a.cylinder(x,44,z+34,14,3,14,CORAL);
      a.box(x+40,32,z,9,64,9,0xbc9b61,true);
    }
    else if(kind==="lifeboat"){
      a.add("sphere",x,26,z,100,34,62,0xc9b58a);a.box(x,35,z,75,5,45,INK);
      for(const dx of [-26,0,26])a.box(x+dx,39,z,9,4,44,0xb78d60,true);
      a.box(x,44,z+23,90,3,4,CORAL);
    }
    else if(kind==="lab_bench"){
      a.box(x,35,z,84,70,23,0x5a7775,true);a.box(x,73,z,92,7,29,0xc0bfa1,true);
      a.cylinder(x-22,84,z,11,17,11,0x93b4a6);a.cylinder(x+12,88,z,8,25,8,0xc7c9ac);a.box(x+12,101,z,7,3,7,CORAL);
    }
  }
  for(const door of world.doors??[]) {
    // Cutaway sliding hatch: panels are parked inside the solid wall pockets.
    // No floating overhead beam, and nothing blocks the server's open threshold.
    const horizontal=door.axis==="x", half=door.width/2, accent=ferry?0xe0b762:observatory?0x9bbdc3:CORAL;
    const box=(along:number,y:number,across:number,w:number,h:number,d:number,color:number,ink=false)=>
      a.box(door.x+(horizontal?along:across),y,door.y+(horizontal?across:along),horizontal?w:d,h,horizontal?d:w,color,ink);
    for(const sign of [-1,1]){
      box(sign*(half+5),32,0,10,64,25,INK,true);
      box(sign*(half+5),33,14,5,56,3,accent);
      box(sign*(half+25),26,0,29,52,18,0x8f9d8c,true);
      box(sign*(half+25),28,10,18,35,2,0x3a535b,true);
      box(sign*(half+25),47,12,18,4,2,accent);
    }
    box(0,3,0,door.width,2,27,0x9fae99);
    for(const sign of [-1,1]){box(0,4,sign*16,door.width-8,1,2,accent);box(sign*16,4,0,8,1,3,accent);}
  }
  for(const item of snapshot.interactables) evidence(a,item);
  if(theme==="campus"){
  // The atrium seal is a floor inlay rather than a screen-space glow.
  a.cylinder(1012,2.3,695,235,1,235,0x637463); a.cylinder(1012,3,695,224,1,224,0x95a083);
  a.cylinder(1012,3.7,695,219,1,219,0x778775); a.cylinder(1012,4.4,695,15,1,15,0xe3c58d);
  a.box(1012,4,695,1,.5,245,0xb9b998); a.box(1012,4,695,245,.5,1,0xb9b998);
  }
  a.finish(scene);
  addFloorLettering(scene,world.rooms,theme);
}

export function buildEvidence(scene:T.Scene,item:Interactable) {
  const art=new Illustration();evidence(art,{...item,x:0,y:0});art.finish(scene);
}

function addFloorLettering(scene: T.Scene, rooms: RoomSnapshot["world"]["rooms"],theme="campus") {
  const canvas = document.createElement("canvas"); canvas.width=2048; const rows=Math.ceil(rooms.length/4);canvas.height=rows*256;
  const ctx=canvas.getContext("2d"); if(!ctx) return;
  const geometries: T.BufferGeometry[]=[];
  rooms.forEach((r,i) => {
    const column=i%4, row=Math.floor(i/4), x=column*512, y=row*256;
    ctx.fillStyle="#e6d9b8"; ctx.font="700 31px 'Space Grotesk', sans-serif"; ctx.textAlign="center";
    ctx.fillText(r.name.toUpperCase(),x+256,y+115,480);
    ctx.fillStyle="#c7cfb7"; ctx.font="17px monospace"; ctx.fillText(`${theme==="campus"?"ORPHEUS":theme==="ferry"?"SALTWIND":"MERIDIAN"}  /  ${String(i+1).padStart(2,"0")}`,x+256,y+149);
    const geometry=new T.PlaneGeometry(Math.min(r.w-32,365),116);
    const uv=geometry.getAttribute("uv");
    for(let v=0;v<uv.count;v++) uv.setXY(v,(column+uv.getX(v))/4,1-(row+1-uv.getY(v))/rows);
    geometry.rotateX(-Math.PI/2); geometry.translate(r.x+r.w/2,5,r.y+r.h*.72); geometries.push(geometry);
  });
  const texture=new T.CanvasTexture(canvas); texture.colorSpace=T.SRGBColorSpace; texture.anisotropy=2;
  const merged=mergeGeometries(geometries); geometries.forEach(g=>g.dispose());
  if(merged) scene.add(new T.Mesh(merged,new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.68,depthWrite:false})));
}

export class WitnessModel {
  readonly group=new T.Group();
  readonly left=new T.Group(); readonly right=new T.Group(); readonly head=new T.Group();
  private coat: T.MeshLambertMaterial;
  private hair: T.MeshLambertMaterial;
  private hairShell: T.Mesh;
  private knit: T.MeshLambertMaterial;
  private accessories=new T.Group();
  private geometries: T.BufferGeometry[]=[];
  private materials: T.Material[]=[];
  constructor(color: number, hat: string) {
    this.coat=this.material(color); this.hair=this.material(0x20363e); this.knit=this.material(color);
    const ink=this.material(INK), skin=this.material(0xe7c59d), paper=this.material(PAPER);
    this.box(this.group,0,39,0,29,34,19,this.coat);
    this.box(this.group,-17,41,0,8,28,10,this.coat,0,0,.13); this.box(this.group,17,41,0,8,28,10,this.coat,0,0,-.13);
    this.box(this.group,-17,26,0,7,8,9,skin); this.box(this.group,17,26,0,7,8,9,skin);
    this.group.add(this.left,this.right); this.left.position.set(-8,22,0); this.right.position.set(8,22,0);
    this.box(this.left,0,-9,0,10,23,11,ink); this.box(this.right,0,-9,0,10,23,11,ink);
    this.box(this.left,0,-19,3,12,7,18,ink); this.box(this.right,0,-19,3,12,7,18,ink);
    this.head.position.y=65; this.group.add(this.head);
    const skull=new T.Mesh(this.geometry(new T.SphereGeometry(1,10,7)),skin); skull.scale.set(17,19,15); this.head.add(skull);
    this.hairShell=new T.Mesh(this.geometry(new T.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.53)),this.hair);
    this.hairShell.name="fitted-hair"; this.hairShell.scale.set(18,20,16); this.hairShell.position.y=4; this.head.add(this.hairShell);
    for(const x of [-6,6]) this.box(this.head,x,0,14,2,5,2,ink);
    this.box(this.head,0,-9,14,8,2,2,ink);
    this.box(this.group,7,40,11,10,13,2,paper,0,0,-.06); this.box(this.group,7,40,12.5,6,2,1,ink);
    this.box(this.group,-7,47,11,6,12,3,paper,0,0,.2);
    this.head.add(this.accessories); this.appearance(color,hat);
    this.accessories.name="headwear";
    const shadow=new T.Mesh(this.geometry(new T.CircleGeometry(23,16)),new T.MeshBasicMaterial({color:0x10232b,transparent:true,opacity:.24,depthWrite:false}));
    this.materials.push(shadow.material); shadow.rotation.x=-Math.PI/2; shadow.position.y=6; this.group.add(shadow);
    for(const part of [this.group,this.left,this.right,this.head])this.batch(part);
  }
  private material(color: number) { const material=new T.MeshLambertMaterial({color,flatShading:true}); this.materials.push(material); return material; }
  private geometry<G extends T.BufferGeometry>(geometry:G) { this.geometries.push(geometry); return geometry; }
  private batch(parent:T.Group) {
    const byMaterial=new Map<T.Material,T.Mesh[]>();
    for(const child of parent.children)if(child instanceof T.Mesh&&!Array.isArray(child.material)) {
      const items=byMaterial.get(child.material)??[];items.push(child);byMaterial.set(child.material,items);
    }
    for(const [material,meshes] of byMaterial)if(meshes.length>1) {
      const transformed=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
      const merged=mergeGeometries(transformed);transformed.forEach(g=>g.dispose());if(!merged)continue;
      for(const mesh of meshes){parent.remove(mesh);mesh.geometry.dispose();const at=this.geometries.indexOf(mesh.geometry);if(at>=0)this.geometries.splice(at,1);}
      parent.add(new T.Mesh(this.geometry(merged),material));
    }
  }
  private box(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material,rx=0,ry=0,rz=0) {
    const mesh=new T.Mesh(this.geometry(new T.BoxGeometry(w,h,d)),material); mesh.position.set(x,y,z); mesh.rotation.set(rx,ry,rz); parent.add(mesh); return mesh;
  }
  appearance(color:number,hat:string) {
    this.coat.color.setHex(color);
    this.knit.color.setHex(color).multiplyScalar(.76);
    // Cut the hair at the actual headwear seat, including the back of the
    // head. Scaling a hat over the full hairstyle left strands in its crown.
    const ceiling:Record<string,number>={beanie:8,cap:10,fedora:12,beret:12};
    const oldHair=this.hairShell.geometry;
    const fitted=this.geometry(new T.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.53));
    const vertices=fitted.getAttribute("position");
    for(let i=0;i<vertices.count;i++)vertices.setY(i,Math.min(vertices.getY(i),((ceiling[hat]??24)-4)/20));
    fitted.computeVertexNormals(); this.hairShell.geometry=fitted;
    oldHair.dispose(); const oldIndex=this.geometries.indexOf(oldHair);if(oldIndex>=0)this.geometries.splice(oldIndex,1);
    // Appearance changes are rare; old accessory geometries are disposed immediately.
    this.accessories.children.forEach(child=>{ if(child instanceof T.Mesh) { child.geometry.dispose(); const at=this.geometries.indexOf(child.geometry); if(at>=0)this.geometries.splice(at,1); } });
    this.accessories.clear();
    const dome=(x:number,y:number,w:number,h:number,d:number,material:T.Material)=>{
      const mesh=new T.Mesh(this.geometry(new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2)),material);
      mesh.position.set(x,y,0);mesh.scale.set(w,h,d);this.accessories.add(mesh);return mesh;
    };
    const oval=(x:number,y:number,z:number,r:number,h:number,depth:number,material:T.Material,top=r)=>{
      const mesh=new T.Mesh(this.geometry(new T.CylinderGeometry(top,r,h,12)),material);
      mesh.position.set(x,y,z);mesh.scale.z=depth/r;this.accessories.add(mesh);return mesh;
    };
    if(hat==="beanie") {
      dome(0,10,20,20,18,this.coat);
      oval(0,10,0,21,8,19,this.knit);
      // A rolled, ribbed cuff, with no brim or projecting peak.
      for(let i=0;i<12;i++){
        const angle=i*Math.PI/6;
        this.box(this.accessories,Math.sin(angle)*20.4,10,Math.cos(angle)*18.4,1,5,1,this.coat);
      }
    } else if(hat==="cap") {
      dome(0,11,20,15,18,this.coat);oval(0,11,0,20,4,18,this.knit);
      oval(0,11,19,16,3,15,this.coat);
    } else if(hat==="headphones") {
      const band=new T.Mesh(this.geometry(new T.TorusGeometry(21,2.4,6,18,Math.PI)),this.hair);
      band.position.set(0,4,0);band.scale.y=1.05;this.accessories.add(band);
      for(const sign of [-1,1]){
        const cushion=new T.Mesh(this.geometry(new T.CylinderGeometry(8,8,6,12)),this.hair);
        cushion.rotation.z=Math.PI/2;cushion.position.set(sign*20,3,0);this.accessories.add(cushion);
        const cup=new T.Mesh(this.geometry(new T.CylinderGeometry(7,7,4,12)),this.coat);
        cup.rotation.z=Math.PI/2;cup.position.set(sign*24,3,0);this.accessories.add(cup);
      }
    }
    if(hat==="glasses"){
      for(const x of [-7,7]){this.box(this.accessories,x,0,15,12,2,3,this.hair);this.box(this.accessories,x,-6,15,12,2,3,this.hair);for(const dx of [-5,5])this.box(this.accessories,x+dx,-3,15,2,7,3,this.hair);}
      this.box(this.accessories,0,-2,16,4,2,3,this.hair);
    }
    if(hat==="beret"){
      oval(0,13,0,20,4,18,this.knit);
      const crown=dome(-3,14,24,12,20,this.coat);crown.rotation.z=.12;
      oval(-3,26,0,2,3,2,this.knit);
    } else if(hat==="fedora"){
      oval(0,13,0,27,3,23,this.coat);
      oval(0,24,0,20,21,18,this.coat,16);
      oval(0,17,0,20.3,5,18.3,this.knit,19.4);
      this.box(this.accessories,0,35,0,4,2,22,this.knit);
    } else if(hat==="visor"){
      // Open crown: the hair is intentionally visible above the band.
      oval(0,9,0,19,4,17,this.coat);
      oval(0,10,21,17,3,14,this.coat);
    }
    this.batch(this.accessories);
  }
  private walk=0;
  private stride=0;
  animate(_now:number,moving:boolean,reduced:boolean,seconds=1/60) {
    this.stride+=(Number(moving&&!reduced)-this.stride)*(1-Math.exp(-seconds/.07));
    if(moving)this.walk+=seconds*13;
    const gait=reduced?0:Math.sin(this.walk)*.45*this.stride;
    this.left.rotation.x=gait; this.right.rotation.x=-gait;
    this.head.rotation.z=reduced?0:Math.sin(this.walk)*.02*this.stride;
  }
  dispose() { this.geometries.forEach(g=>g.dispose()); this.materials.forEach(m=>m.dispose()); }
}

export function textSprite(text:string, background="#152c33", size=34, width=Math.min(640,Math.max(160,text.length*21))) {
  const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=64;
  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle=background; ctx.fillRect(0,0,width,64); ctx.fillStyle="#f2e4c8"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.font=`700 ${size}px 'Space Grotesk', sans-serif`; ctx.fillText(text,width/2,32,width-24);
  const texture=new T.CanvasTexture(canvas); texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true,depthWrite:false,transparent:true,opacity:.94}));
  sprite.scale.set(width*.62,40,1); sprite.renderOrder=10; return sprite;
}
