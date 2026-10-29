import {afterEach,beforeEach,expect,it,vi} from "vitest";
import * as T from "three";
import campus from "./campus.fixture.json";
import observatory from "./observatory.fixture.json";
import ferry from "./ferry.fixture.json";
import {buildCampus,WitnessModel} from "./Art";
import type {RoomSnapshot} from "../../types/protocol";

beforeEach(()=>{vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({fillRect:vi.fn(),fillText:vi.fn()} as unknown as CanvasRenderingContext2D);});
afterEach(()=>vi.restoreAllMocks());
it.each([campus,observatory,ferry])("batches expanded themed worlds within the static draw and triangle budget",layout=>{
  const snapshot=layout as unknown as RoomSnapshot;
  const scene=new T.Scene();buildCampus(scene,snapshot);
  expect(scene.children.length).toBeLessThanOrEqual(5);
  const batches=scene.children.filter(o=>o instanceof T.InstancedMesh);
  expect(batches.length).toBeGreaterThanOrEqual(2);expect(batches.length).toBeLessThanOrEqual(3);
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
it("keeps each animated witness within twelve mesh draws",()=>{
  const model=new WitnessModel(0xef805f,"headphones");let meshes=0;
  model.group.traverse(object=>{if(object instanceof T.Mesh)meshes++;});
  expect(meshes).toBeLessThanOrEqual(12);model.dispose();
});
