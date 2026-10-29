import {afterEach,beforeEach,expect,it,vi} from "vitest";
import * as T from "three";
import {CampusScene} from "./CampusScene";
import type {RoomSnapshot,ServerMessage} from "../../types/protocol";
import type {GameSocket} from "../../network/GameSocket";
import type {MotionCommand} from "../motion";
import {objectThumbnails} from "../artworkCache";

const shared=vi.hoisted(()=>({scene:null as unknown,camera:null as unknown,dispose:vi.fn(),lost:vi.fn(),size:vi.fn(),fail:false,renders:0}));
vi.mock("three",async()=>{
  const actual=await vi.importActual<typeof import("three")>("three");
  return {...actual,WebGLRenderer:class {
    domElement=document.createElement("canvas");info={render:{calls:80,triangles:45000},memory:{geometries:26,textures:3}};ratio=1;
    constructor(){if(shared.fail)throw new Error("WebGL unavailable");}
    setClearColor(){}setPixelRatio(n:number){this.ratio=n;}getPixelRatio(){return this.ratio;}setSize=shared.size;
    render(scene:unknown,camera:unknown){shared.renders++;shared.scene=scene;shared.camera=camera;}
    dispose=shared.dispose;forceContextLoss=shared.lost;
  }};
});
vi.mock("../AudioDirector",()=>({audioDirector:{cue:vi.fn()}}));
let callbacks=new Map<number,FrameRequestCallback>(),next=0,now=0;
let receive:(message:ServerMessage)=>void,move:(command:MotionCommand)=>void;
let snapshot:RoomSnapshot,host:HTMLDivElement,scene:CampusScene;
const offMessage=vi.fn(),offMovement=vi.fn(),prompt=vi.fn(),failure=vi.fn();
const frame=(milliseconds=17)=>{now+=milliseconds;const work=[...callbacks.values()];callbacks.clear();work.forEach(callback=>callback(now));};
beforeEach(()=>{
  vi.clearAllMocks();shared.fail=false;shared.renders=0;callbacks=new Map();next=now=0;
  objectThumbnails.clear();vi.spyOn(HTMLCanvasElement.prototype,"toDataURL").mockReturnValue("data:image/png;base64,preview");
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({fillRect:vi.fn(),fillText:vi.fn()} as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("requestAnimationFrame",(callback:FrameRequestCallback)=>{callbacks.set(++next,callback);return next;});
  vi.stubGlobal("cancelAnimationFrame",(id:number)=>callbacks.delete(id));
  vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});
  Object.defineProperty(document,"hidden",{configurable:true,value:false});
  snapshot={type:"snapshot",room:{code:"TEST",host_id:"local",phase:"exploring",min_players:4,max_players:8,map_id:"campus"},
    players:[{id:"local",name:"Local",x:300,y:300,color_index:0,ready:true,connected:true},{id:"other",name:"Other",x:500,y:300,color_index:1,ready:true,connected:true}],
    interactables:[{id:"record",kind:"notebook",label:"Notebook",room:"Atrium",x:310,y:310}],
    world:{width:800,height:700,rooms:[{name:"Atrium",x:0,y:0,w:800,h:700,tint:0}],walls:[[400,350,16,700]]}};
  const socket={snapshot,connected:true,latencyMs:20,onMovement:(listener:typeof move)=>{move=listener;return offMovement;},onMessage:(listener:typeof receive)=>{receive=listener;return offMessage;}} as unknown as GameSocket;
  host=document.createElement("div");document.body.append(host);
  scene=new CampusScene(host,{socket,snapshot,localPlayerId:"local",onPrompt:prompt,onRoomChange:vi.fn(),onFailure:failure});
});
afterEach(()=>{scene.dispose();host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

it("predicts local movement, uses physical 3D occlusion without popping, and exposes nearby real records",()=>{
  scene.start();frame();const rendered=shared.scene as T.Scene;
  const groups=rendered.children.filter(child=>child instanceof T.Group);
  expect(groups).toHaveLength(2);expect(groups[0].visible).toBe(true);expect(groups[1].visible).toBe(true);
  expect(prompt).toHaveBeenCalledWith(snapshot.interactables[0]);
  expect(objectThumbnails.get("notebook")).toMatch(/^data:image\/png/);
  const before=groups[0].position.x;move({dx:1,dy:0,sequence:1,at:now});for(let i=0;i<8;i++)frame();
  expect(groups[0].position.x).toBeGreaterThan(before);expect(groups[0].position.x).toBeLessThan(380);
});
it("resets presentation after reconnect and disposes a replaced player's resources",()=>{
  scene.start();frame();const disposal=vi.spyOn(T.BufferGeometry.prototype,"dispose");
  const replacement={...snapshot,players:[{...snapshot.players[0],x:150,y:160}]};
  receive(replacement);frame();const groups=(shared.scene as T.Scene).children.filter(child=>child instanceof T.Group);
  expect(groups).toHaveLength(1);expect(groups[0].position.x).toBeCloseTo(150);
  expect(disposal).toHaveBeenCalled();
});
it("pauses rendering in hidden tabs and cancels all rendering and subscriptions on disposal",()=>{
  scene.start();frame();expect(callbacks.size).toBe(1);
  Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));expect(callbacks.size).toBe(0);
  Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));expect(callbacks.size).toBe(1);
  scene.dispose();expect(host.querySelector("canvas")).toBeNull();expect(callbacks.size).toBe(0);
  expect(offMessage).toHaveBeenCalledOnce();expect(offMovement).toHaveBeenCalledOnce();expect(shared.dispose).toHaveBeenCalledOnce();expect(shared.lost).toHaveBeenCalledOnce();
});
it("handles context loss and zero-sized containers without a zero framebuffer",()=>{
  scene.start();expect(shared.size).toHaveBeenCalledWith(320,240,false);
  host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));expect(failure).toHaveBeenCalledOnce();
});
it("reduces resolution after sustained slow frames while preserving simulation coordinates",()=>{
  scene.start();for(let i=0;i<150;i++)frame(50);
  expect(Number(host.querySelector("canvas")!.dataset.pixelRatio)).toBeLessThan(1);
  const groups=(shared.scene as T.Scene).children.filter(child=>child instanceof T.Group);
  expect(groups[0].position.x).toBe(300);expect(groups[0].position.z).toBe(300);
});
it("can clean up safely after graphics initialization fails",()=>{
  shared.fail=true;expect(()=>scene.start()).toThrow("WebGL unavailable");scene.dispose();
  expect(host.querySelector("canvas")).toBeNull();expect(callbacks.size).toBe(0);
});
it("renders every 16.5ms display frame instead of dropping half of them",()=>{
  scene.start();const before=shared.renders;for(let i=0;i<120;i++)frame(16.5);
  expect(shared.renders-before).toBe(120);
});
