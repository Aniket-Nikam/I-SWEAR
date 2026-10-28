import {afterEach,beforeEach,expect,it,vi} from "vitest";
import * as T from "three";
import {buildCampus,WitnessModel} from "./Art";
import type {RoomSnapshot} from "../../types/protocol";

beforeEach(()=>{vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({fillRect:vi.fn(),fillText:vi.fn()} as unknown as CanvasRenderingContext2D);});
afterEach(()=>vi.restoreAllMocks());
it("batches a full fifteen-room campus into five static draws with a bounded triangle count",()=>{
  const names=["Lab A","Lab B","Lab C","Main Hall","Central Atrium","Emergency Exit","Storage","Security Office","CCTV Room","Server Room","Archive Room","Records Annex","Break Room","Service Tunnel","Glasshouse"];
  const snapshot={world:{width:2048,height:1940,walls:Array.from({length:50},(_,i)=>[100+i*20,486,100,16]),rooms:names.map((name,i)=>({name,x:(i%3)*650,y:Math.floor(i/3)*390,w:600,h:350,tint:0}))},interactables:Array.from({length:25},(_,i)=>({id:String(i),kind:["badge_scanner","power_panel","notebook","storage_cabinet","security_log"][i%5],x:i*50,y:600,label:"Record",room:"Lab A"}))} as RoomSnapshot;
  const scene=new T.Scene();buildCampus(scene,snapshot);
  expect(scene.children).toHaveLength(5);
  const batches=scene.children.filter(o=>o instanceof T.InstancedMesh);
  expect(batches).toHaveLength(3);
  const triangles=batches.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??0)/3*mesh.count,0);
  expect(triangles).toBeLessThan(80000);
  for(const mesh of batches)expect(mesh.instanceMatrix.usage).toBe(T.StaticDrawUsage);
  expect(scene.children.some(o=>o instanceof T.LineSegments)).toBe(true);
});
it("releases replaced accessories and all character resources on disposal",()=>{
  const disposed=vi.spyOn(T.BufferGeometry.prototype,"dispose");
  const model=new WitnessModel(0xef805f,"headphones");
  disposed.mockClear();model.appearance(0xa9cfbd,"cap");expect(disposed).toHaveBeenCalled();
  const count=model.group.children.length;
  for(let i=0;i<10;i++)model.appearance(0xef805f,i%2?"headphones":"beanie");
  expect(model.group.children.length).toBe(count);
  model.animate(100,true,true);expect(model.left.rotation.x).toBe(0);
  model.dispose();expect(disposed.mock.calls.length).toBeGreaterThan(35);
});
it("keeps each animated witness below twelve mesh draws",()=>{
  const model=new WitnessModel(0xef805f,"headphones");let meshes=0;
  model.group.traverse(object=>{if(object instanceof T.Mesh)meshes++;});
  expect(meshes).toBeLessThanOrEqual(11);model.dispose();
});
