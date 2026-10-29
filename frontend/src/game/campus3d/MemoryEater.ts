import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Original paper-mask creature: five opaque mesh draws, no textures or lights. */
export class MemoryEater {
 readonly group=new T.Group();
 private head=new T.Group();
 private jaw=new T.Group();
 private meshes:T.Mesh[]=[];
 constructor(){
  const ink=0x09171c,bone=0xd5c6a3,bruise=0x493b3c;
  type Part=["box"|"cone"|"sphere",number,number,number,number,number,number,number,number?];
  const batch=(parent:T.Group,parts:Part[],glow=false)=>{
   const pieces=parts.map(([form,x,y,z,w,h,d,color,turn=0])=>{
    const geometry=form==="box"?new T.BoxGeometry(1,1,1):form==="cone"?new T.ConeGeometry(.5,1,5):new T.SphereGeometry(.5,8,6);
    geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,0,turn)),new T.Vector3(w,h,d)));
    const colors=new Float32Array(geometry.getAttribute("position").count*3),value=new T.Color(color);
    for(let i=0;i<colors.length;i+=3){colors[i]=value.r;colors[i+1]=value.g;colors[i+2]=value.b;}
    geometry.setAttribute("color",new T.BufferAttribute(colors,3));return geometry;
   });
   const geometry=mergeGeometries(pieces,false)!;pieces.forEach(piece=>piece.dispose());
   const material=glow?new T.MeshBasicMaterial({vertexColors:true}):new T.MeshLambertMaterial({vertexColors:true,flatShading:true});
   const mesh=new T.Mesh(geometry,material);parent.add(mesh);this.meshes.push(mesh);
  };
  const body:Part[]=[["cone",0,57,0,52,75,27,ink],["box",0,77,0,30,21,20,ink]];
  for(const sign of [-1,1]){
   body.push(["box",sign*25,57,0,10,62,10,ink,sign*.22],["box",sign*34,23,3,9,26,8,bruise,sign*.18],
    ["box",sign*13,15,0,9,32,9,ink,sign*.12],["cone",sign*25,100,-2,9,51,9,bone,sign*-.28]);
   for(let i=0;i<3;i++)body.push(["cone",sign*35+(i-1)*5,7,8,3,27,4,bone,Math.PI+sign*.1]);
  }
  for(let i=0;i<5;i++)body.push(["box",0,43+i*7,14,28-i*2,2,2,bruise,(i%2?.09:-.09)]);
  batch(this.group,body);
  this.head.position.y=104;this.jaw.position.set(0,-21,0);this.group.add(this.head);this.head.add(this.jaw);
  batch(this.head,[["sphere",0,3,0,46,57,30,bone],["box",0,-10,13,35,23,7,ink],
   ["box",-11,10,14,16,14,4,ink,-.2],["box",11,10,14,16,14,4,ink,.2],
   ["box",2,25,15,2,17,2,bruise,.35],["box",-5,20,16,12,2,2,bruise,-.4]]);
  const jaw:Part[]=[["sphere",0,-9,6,43,24,28,bone],["box",0,-3,17,32,11,7,ink]];
  const teeth:Part[]=[];
  for(let i=0;i<9;i++){
   const x=(i-4)*4;
   teeth.push(["cone",x,-16,18,4,i%2?12:17,5,bone,Math.PI]);
   jaw.push(["cone",x,3,17,4,i%2?11:15,5,bone]);
  }
  // Teeth share the mask batch by merging once; the moving jaw stays separate.
  batch(this.head,teeth);batch(this.jaw,jaw);
  batch(this.head,[["sphere",-11,10,17,4,6,2,0xef805f],["sphere",11,10,17,4,6,2,0xef805f]],true);
 }
 animate(now:number,devouring:boolean,reduced:boolean){
  this.head.rotation.z=reduced?0:Math.sin(now*.0017)*.09;
  this.jaw.rotation.x=devouring?1.15+(reduced?0:Math.sin(now*.023)*.14):.25+(reduced?0:Math.sin(now*.003)*.12);
  this.head.position.y=104+(reduced?0:Math.sin(now*.003)*2);
 }
 dispose(){for(const mesh of this.meshes){mesh.geometry.dispose();(mesh.material as T.Material).dispose();}this.group.removeFromParent();this.group.clear();}
}
