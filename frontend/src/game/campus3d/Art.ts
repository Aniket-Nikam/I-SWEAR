import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Interactable, RoomSnapshot } from "../../types/protocol";

export const INK = 0x152c33, PAPER = 0xf2e4c8, SAGE = 0xb2ceba, CORAL = 0xef805f;
type Form = "box" | "cylinder" | "sphere";
interface Part { form: Form; x: number; y: number; z: number; w: number; h: number; d: number; color: number; turn: number }

/** Static furniture and architecture become three instanced draws and one ink pass. */
class Illustration {
  parts: Part[] = [];
  edges: number[] = [];
  add(form: Form, x: number, y: number, z: number, w: number, h: number, d: number, color: number, ink = false, turn = 0) {
    this.parts.push({ form, x, y, z, w, h, d, color, turn });
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
        matrix.position.set(part.x,part.y,part.z); matrix.scale.set(part.w,part.h,part.d); matrix.rotation.set(0,part.turn,0); matrix.updateMatrix();
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
  a.box(x,31,z,width-12,2,2,0xe0bb83);
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
  a.box(world.width/2,-15,world.height/2,world.width+52,30,world.height+52,INK,true);
  a.box(world.width/2,-1,world.height/2,world.width,4,world.height,0x536259);
  const tones = [0x758577,0x7e8c7c,0x839180,0x738477];
  world.rooms.forEach((r,index) => {
    const wood = /Archive|Records|Break/.test(r.name), garden = /Glasshouse/.test(r.name);
    a.box(r.x+r.w/2,0,r.y+r.h/2,r.w,3,r.h,wood?0x9b8464:garden?0x6d8066:tones[index%4]);
    // Thin painted seams, not individually shaded tiles: one instanced box draw.
    for (let x=r.x+40;x<r.x+r.w;x+=wood?80:64) a.box(x,2,r.y+r.h/2,1,.5,r.h,wood?0x877557:0x6b7b6c);
    for (let z=r.y+40;z<r.y+r.h;z+=wood?28:64) a.box(r.x+r.w/2,2,z,r.w,.5,1,wood?0x877557:0x6b7b6c);
    const back = r.y+22;
    if (/Lab/.test(r.name)) {
      for(let i=0;i<3;i++) { const x=r.x+110+i*100; if(x>r.x+r.w-50) break;
        a.box(x,35,back,84,70,23,0x5a7775,true); a.box(x,73,back,92,7,29,0xc0bfa1,true);
        a.cylinder(x-22,84,back,11,17,11,0x93b4a6); a.cylinder(x+12,88,back,8,25,8,0xc7c9ac);
        a.box(x+12,101,back,7,3,7,CORAL);
      }
      plant(a,r.x+r.w-42,r.y+42);
    } else if (/Archive|Records|Storage/.test(r.name)) {
      shelves(a,r.x+r.w/2,back,Math.min(r.w-65,300),index); plant(a,r.x+35,r.y+r.h-38);
    } else if (/Server|CCTV|Security/.test(r.name)) {
      for(let i=0;i<3;i++) cabinet(a,r.x+48+i*65,back,50,true);
    } else if (garden) {
      for(let i=0;i<5;i++) plant(a,r.x+40+i*(r.w-80)/4,back+20);
      bench(a,r.x+r.w/2,r.y+r.h-30,150);
    } else {
      bench(a,r.x+r.w*.5,back,Math.min(190,r.w-90));
      plant(a,r.x+35,back+15); plant(a,r.x+r.w-35,back+15);
      if(/Break/.test(r.name)) { a.box(r.x+52,43,r.y+r.h-28,68,86,32,0xb59b79,true); a.box(r.x+52,70,r.y+r.h-10,44,26,3,INK,true); }
    }
    // Small warm wall fixtures use emissive-looking paint, with no point-light/shadow cost.
    a.box(r.x+r.w-48,98,r.y+4,37,11,11,INK,true); a.box(r.x+r.w-48,96,r.y+11,29,6,4,0xf1c976);
  });
  for(const [x,z,w,d] of world.walls) {
    const height = z<70 || x<60 ? 128 : 45;
    a.box(x,height/2,z,w,height,d,0x45605f,true);
    a.box(x,height+3,z,w+3,6,d+3,0xa8b7a0,true);
    a.box(x,6,z,w+3,12,d+3,INK);
  }
  for(const item of snapshot.interactables) evidence(a,item);
  // The atrium seal is a floor inlay rather than a screen-space glow.
  a.cylinder(1012,2.3,695,235,1,235,0x637463); a.cylinder(1012,3,695,224,1,224,0x95a083);
  a.cylinder(1012,3.7,695,219,1,219,0x778775); a.cylinder(1012,4.4,695,15,1,15,0xe3c58d);
  a.box(1012,4,695,1,.5,245,0xb9b998); a.box(1012,4,695,245,.5,1,0xb9b998);
  a.finish(scene);
  addFloorLettering(scene,world.rooms);
}

export function buildEvidence(scene:T.Scene,item:Interactable) {
  const art=new Illustration();evidence(art,{...item,x:0,y:0});art.finish(scene);
}

function addFloorLettering(scene: T.Scene, rooms: RoomSnapshot["world"]["rooms"]) {
  const canvas = document.createElement("canvas"); canvas.width=2048; canvas.height=1024;
  const ctx=canvas.getContext("2d"); if(!ctx) return;
  const geometries: T.BufferGeometry[]=[];
  rooms.forEach((r,i) => {
    const column=i%4, row=Math.floor(i/4), x=column*512, y=row*256;
    ctx.fillStyle="#e6d9b8"; ctx.font="700 31px 'Space Grotesk', sans-serif"; ctx.textAlign="center";
    ctx.fillText(r.name.toUpperCase(),x+256,y+115,480);
    ctx.fillStyle="#c7cfb7"; ctx.font="17px monospace"; ctx.fillText(`ORPHEUS  /  ${String(i+1).padStart(2,"0")}`,x+256,y+149);
    const geometry=new T.PlaneGeometry(Math.min(r.w-32,365),116);
    const uv=geometry.getAttribute("uv");
    for(let v=0;v<uv.count;v++) uv.setXY(v,(column+uv.getX(v))/4,1-(row+1-uv.getY(v))/4);
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
  private accessories=new T.Group();
  private geometries: T.BufferGeometry[]=[];
  private materials: T.Material[]=[];
  constructor(color: number, hat: string) {
    this.coat=this.material(color); this.hair=this.material(0x20363e);
    const ink=this.material(INK), skin=this.material(0xe7c59d), paper=this.material(PAPER);
    this.box(this.group,0,39,0,29,34,19,this.coat);
    this.box(this.group,-17,41,0,8,28,10,this.coat,0,0,.13); this.box(this.group,17,41,0,8,28,10,this.coat,0,0,-.13);
    this.box(this.group,-17,26,0,7,8,9,skin); this.box(this.group,17,26,0,7,8,9,skin);
    this.group.add(this.left,this.right); this.left.position.set(-8,22,0); this.right.position.set(8,22,0);
    this.box(this.left,0,-9,0,10,23,11,ink); this.box(this.right,0,-9,0,10,23,11,ink);
    this.box(this.left,0,-19,3,12,7,18,ink); this.box(this.right,0,-19,3,12,7,18,ink);
    this.head.position.y=65; this.group.add(this.head);
    const skull=new T.Mesh(this.geometry(new T.SphereGeometry(1,10,7)),skin); skull.scale.set(17,19,15); this.head.add(skull);
    const hair=new T.Mesh(this.geometry(new T.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.53)),this.hair); hair.scale.set(18,20,16); hair.position.y=4; this.head.add(hair);
    for(const x of [-6,6]) this.box(this.head,x,0,14,2,5,2,ink);
    this.box(this.head,0,-9,14,8,2,2,ink);
    this.box(this.group,7,40,11,10,13,2,paper,0,0,-.06); this.box(this.group,7,40,12.5,6,2,1,ink);
    this.box(this.group,-7,47,11,6,12,3,paper,0,0,.2);
    this.head.add(this.accessories); this.appearance(color,hat);
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
    // Appearance changes are rare; old accessory geometries are disposed immediately.
    this.accessories.children.forEach(child=>{ if(child instanceof T.Mesh) { child.geometry.dispose(); const at=this.geometries.indexOf(child.geometry); if(at>=0)this.geometries.splice(at,1); } });
    this.accessories.clear();
    if(hat==="beanie" || hat==="cap") {
      const mesh=new T.Mesh(this.geometry(new T.CylinderGeometry(18,19,hat==="cap"?10:16,10)),this.coat);
      mesh.position.y=18; this.accessories.add(mesh);
      this.box(this.accessories,0,hat==="cap"?14:12,hat==="cap"?13:0,hat==="cap"?32:38,4,hat==="cap"?24:33,this.coat);
    } else if(hat==="headphones") {
      for(const x of [-20,20])this.box(this.accessories,x,3,0,8,18,17,this.coat);
      this.box(this.accessories,0,24,0,42,5,10,this.coat);
    }
    this.batch(this.accessories);
  }
  animate(now:number,moving:boolean,reduced:boolean) {
    const gait=moving&&!reduced?Math.sin(now*.013)*.5:0;
    this.left.rotation.x=gait; this.right.rotation.x=-gait;
    this.head.rotation.z=moving&&!reduced?Math.sin(now*.013)*.025:0;
  }
  dispose() { this.geometries.forEach(g=>g.dispose()); this.materials.forEach(m=>m.dispose()); }
}

export function textSprite(text:string, background="#152c33", size=28, width=Math.min(512,Math.max(128,text.length*18))) {
  const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=64;
  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle=background; ctx.fillRect(0,0,width,64); ctx.fillStyle="#f2e4c8"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.font=`700 ${size}px 'Space Grotesk', sans-serif`; ctx.fillText(text,width/2,32,width-24);
  const texture=new T.CanvasTexture(canvas); texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,transparent:true,opacity:.94}));
  sprite.scale.set(width*.5,32,1); sprite.renderOrder=10; return sprite;
}
