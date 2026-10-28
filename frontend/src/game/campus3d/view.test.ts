import {expect,it} from "vitest";
import {CAMERA_YAW,renderSize,screenMovement} from "./view";

it("keeps screen directions orthogonal and maps up toward the camera's far side",()=>{
  const right=screenMovement(1,0),down=screenMovement(0,1),up=screenMovement(0,-1);
  expect(right.dx*down.dx+right.dy*down.dy).toBeCloseTo(0);
  expect(right.dx).toBeCloseTo(Math.cos(CAMERA_YAW));expect(up.dy).toBeLessThan(0);
  for(const [dx,dy] of [[0,0],[1,0],[0,-1],[1,1],[-1,1]]) {
    const world=screenMovement(dx,dy);expect(Math.hypot(world.dx,world.dy)).toBeCloseTo(Math.hypot(dx,dy));
  }
});
it("bounds the framebuffer on hidden, mobile, and high-density displays",()=>{
  expect(renderSize(0,0,3)).toEqual({width:320,height:240,pixelRatio:1.5});
  expect(renderSize(390,844,4).pixelRatio).toBe(1.5);
  expect(renderSize(1200,800,2,.65).pixelRatio).toBeCloseTo(.975);
  expect(renderSize(1200,800,NaN).pixelRatio).toBe(1);
});
