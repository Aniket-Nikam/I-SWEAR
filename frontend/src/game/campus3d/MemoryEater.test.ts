import {expect,it,vi} from "vitest";
import * as T from "three";
import {MemoryEater} from "./MemoryEater";
it("keeps the creature at five opaque draws without textures and releases its resources",()=>{
 const creature=new MemoryEater(),disposed=vi.spyOn(T.BufferGeometry.prototype,"dispose");let draws=0,triangles=0;
 creature.group.traverse(object=>{if(object instanceof T.Mesh){draws++;triangles+=(object.geometry.index?.count??0)/3;expect((object.material as T.MeshLambertMaterial).map).toBeFalsy();}});
 expect(draws).toBeLessThanOrEqual(5);expect(triangles).toBeLessThan(6000);
 creature.animate(100,true,true);const before=creature.group.children[1].rotation.z;
 creature.animate(300,true,true);expect(creature.group.children[1].rotation.z).toBe(before);
 creature.dispose();expect(disposed).toHaveBeenCalledTimes(5);disposed.mockRestore();
});
