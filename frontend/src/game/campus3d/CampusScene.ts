import * as T from "three";
import type { GameSocket } from "../../network/GameSocket";
import type { Interactable, PlayerState, RoomPhase, RoomSnapshot, ServerMessage, HorrorState, CreaturePose } from "../../types/protocol";
import { LocalMotion, RemoteMotion } from "../motion";
import { hasLineOfSight } from "../visibility";
import { avatarColors } from "../palette";
import { audioDirector } from "../AudioDirector";
import { recordFrame, resetFrames } from "../performance";
import { buildCampus, buildEvidence, WitnessModel, textSprite, CORAL } from "./Art";
import { CAMERA_YAW, renderSize } from "./view";
import { MemoryEater } from "./MemoryEater";
import { objectThumbnails } from "../artworkCache";

interface Options {
  socket:GameSocket; snapshot:RoomSnapshot; localPlayerId:string;
  onPrompt:(item:Interactable|null)=>void; onRoomChange:(room:string)=>void; onFailure:()=>void; onReady?:()=>void; guideTarget?:()=>string|undefined;previewScare?:()=>boolean;
}
interface Visual {
  model:WitnessModel; label:T.Sprite; motion:RemoteMotion; color:number; hat:string; name:string;
  bubble?:T.Sprite; bubbleUntil:number; x:number; z:number;
}

/** The server still owns a flat simulation. This class only presents its state. */
export class CampusScene {
  private scene=new T.Scene();
  private horror:HorrorState|null=null;
  private creature:MemoryEater|null=null;
  private maw:MemoryEater|null=null;
  private creatureMotion=new RemoteMotion();
  private scareAt=0;
  private showingScare=false;
  private camera=new T.OrthographicCamera(-500,500,450,-450,1,5000);
  private renderer:T.WebGLRenderer|null=null;
  private players=new Map<string,Visual>();
  private localMotion:LocalMotion;
  private phase:RoomPhase;
  private nearest:string|null=null;
  private room="";
  private off:(()=>void)[]=[];
  private observer:ResizeObserver|null=null;
  private raf=0;
  private stopped=false;
  private ready=false;
  private previous=0;
  private cadence=0;
  private tick=0;
  private quality=1;
  private slowFrames=0;
  private fastFrames=0;
  private lastFootstep=0;
  private metricsAt=0;
  private revealStep=-1;
  private target=new T.Vector3();
  private cameraTarget=new T.Vector3();
  private offset=new T.Vector3(Math.sin(CAMERA_YAW)*1000,1450,Math.cos(CAMERA_YAW)*1000);
  private focusRing=new T.Mesh(new T.RingGeometry(30,33,36),new T.MeshBasicMaterial({color:CORAL,transparent:true,opacity:.85,depthWrite:false}));
  private revealRing=new T.Mesh(new T.RingGeometry(65,69,48),new T.MeshBasicMaterial({color:0xf1c976,transparent:true,opacity:.85,depthWrite:false}));
  private guideRing=new T.Mesh(new T.RingGeometry(39,44,36),new T.MeshBasicMaterial({color:0xf1c976,depthWrite:false}));
  private guideLabel=textSprite("YOUR NEXT LEAD", "#193b43", 30);
  private guideId:string|undefined;
  constructor(private host:HTMLElement,private options:Options) {
    const player=options.snapshot.players.find(p=>p.id===options.localPlayerId);
    if(!player) throw new Error("Witness is missing from the room");
    this.horror=options.snapshot.horror??null;
    this.localMotion=new LocalMotion(player,options.snapshot.world); this.phase=options.snapshot.room.phase;
    this.target.set(player.x,0,player.y); this.cameraTarget.copy(this.target);
  }
  start() {
    resetFrames();
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
    this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.renderer.setClearColor(0x101d27); this.renderer.domElement.style.cssText="display:block;width:100%;height:100%";
    this.renderer.domElement.setAttribute("aria-hidden","true");
    this.host.prepend(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight(0xffefd0,0x496369,2.3));
    const light=new T.DirectionalLight(0xffe2ad,2.1); light.position.set(-500,1200,700); this.scene.add(light);
    this.thumbnails();
    // No shadow maps, postprocessing, physics engine, or per-frame world rebuilding.
    buildCampus(this.scene,this.options.snapshot);
    if(this.options.snapshot.room.horror){
      this.creature=new MemoryEater();this.creature.group.scale.set(.5,1,.5);this.maw=new MemoryEater();
      this.creature.group.visible=this.maw.group.visible=false;
      this.scene.add(this.creature.group,this.camera);this.camera.add(this.maw.group);
    }
    for(const player of this.options.snapshot.players)this.player(player);
    this.focusRing.rotation.x=this.revealRing.rotation.x=-Math.PI/2;
    this.focusRing.visible=this.revealRing.visible=false; this.scene.add(this.focusRing,this.revealRing);
    this.guideRing.rotation.x=-Math.PI/2;this.guideRing.visible=this.guideLabel.visible=false;this.scene.add(this.guideRing,this.guideLabel);
    this.off.push(this.options.socket.onMovement(command=>this.localMotion.input(command)));
    this.off.push(this.options.socket.onMessage(message=>this.message(message)));
    this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(this.host); this.resize();
    document.addEventListener("visibilitychange",this.visibility);
    this.renderer.domElement.addEventListener("webglcontextlost",this.contextLost);
    this.schedule();
  }
  private contextLost=(event:Event)=>{event.preventDefault();this.options.onFailure();};
  private thumbnails() {
    if(!this.renderer)return;
    const camera=new T.OrthographicCamera(-68,68,80,-56,1,600);camera.position.set(140,145,200);camera.lookAt(0,38,0);
    this.renderer.setPixelRatio(1);this.renderer.setSize(256,256,false);this.renderer.setClearColor(0xc2cdb4);
    for(const item of this.options.snapshot.interactables)if(!objectThumbnails.has(item.kind)) {
      const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffefd0,0x496369,2.3));
      const light=new T.DirectionalLight(0xffe2ad,2.1);light.position.set(-150,300,180);scene.add(light);buildEvidence(scene,item);
      this.renderer.render(scene,camera);
      objectThumbnails.set(item.kind,this.renderer.domElement.toDataURL("image/png"));this.disposeGraph(scene);
    }
    this.renderer.setClearColor(0x101d27);
  }
  private visibility=()=>{
    this.localMotion.stop(); this.previous=this.cadence=0; resetFrames();
    if(document.hidden) { cancelAnimationFrame(this.raf); this.raf=0; } else this.schedule();
  };
  private schedule() { if(!this.stopped&&!document.hidden&&!this.raf)this.raf=requestAnimationFrame(this.frame); }
  private resize() {
    if(!this.renderer)return;
    const {width,height,pixelRatio}=renderSize(this.host.clientWidth,this.host.clientHeight,window.devicePixelRatio,this.quality);
    this.renderer.setPixelRatio(pixelRatio); this.renderer.setSize(width,height,false);
    const h=width<760?700:880, aspect=width/height;
    this.camera.left=-h*aspect/2; this.camera.right=h*aspect/2; this.camera.top=h/2; this.camera.bottom=-h/2; this.camera.updateProjectionMatrix();
  }
  private player(state:PlayerState) {
    const color=state.avatar_color??state.color_index, hat=state.hat??"none";
    const existing=this.players.get(state.id);
    if(existing) {
      if(existing.color!==color||existing.hat!==hat) { existing.model.appearance(avatarColors[color%avatarColors.length],hat); existing.color=color;existing.hat=hat; }
      if(existing.name!==state.name) { this.disposeSprite(existing.label); existing.label=textSprite(state.name.replace(" (scripted)","")); this.scene.add(existing.label); existing.name=state.name; }
      existing.label.material.opacity=state.connected?.94:.5; return existing;
    }
    const model=new WitnessModel(avatarColors[color%avatarColors.length],hat),label=textSprite(state.name.replace(" (scripted)","")),motion=new RemoteMotion();
    // The body and swinging arms fit inside the authoritative 20px hull.
    model.group.scale.set(.70,1,.70);
    model.group.position.set(state.x,5,state.y); motion.push(state,performance.now());
    const visual:Visual={model,label,motion,color,hat,name:state.name,bubbleUntil:0,x:state.x,z:state.y};
    this.scene.add(model.group,label); this.players.set(state.id,visual); return visual;
  }
  private message(message:ServerMessage) {
    if(this.stopped)return;
    const now=performance.now();
    if(message.type==="horror")this.horror=message.horror;
    if(message.type==="positions"&&message.creature)this.creatureMotion.push(this.creaturePlayer(message.creature),now,message.at);
    if(message.type==="snapshot") {
      this.horror=message.horror??null;
      this.phase=message.room.phase;
      const present=new Set(message.players.map(p=>p.id));
      for(const [id,visual] of this.players)if(!present.has(id)) {this.removePlayer(visual);this.players.delete(id);}
      for(const state of message.players) {
        const visual=this.player(state); visual.motion=new RemoteMotion();visual.motion.push(state,now);
        if(state.id===this.options.localPlayerId)this.localMotion.reset(state);
      }
    } else if(message.type==="positions"||message.type==="presence") {
      for(const state of message.type==="positions"?message.players:[message.player]) {
        const visual=this.player(state);
        if(state.id===this.options.localPlayerId && message.type==="positions")this.localMotion.reconcile(state,this.options.socket.latencyMs,now);
        else visual.motion.push(state,now,message.type==="positions"?message.at:undefined);
      }
    } else if(message.type==="phase_changed") {this.phase=message.phase;if(this.phase!=="exploring")this.localMotion.stop();}
    else if(message.type==="chat") {
      const visual=this.players.get(message.message.player_id); if(!visual)return;
      if(visual.bubble)this.disposeSprite(visual.bubble);
      const preview=message.message.text.length>36?`${message.message.text.slice(0,33)}…`:message.message.text;
      visual.bubble=textSprite(preview,"#f2e4c8",34,640);
      // Paper bubbles use ink lettering; changing their canvas happens only per chat.
      const map=visual.bubble.material.map; if(map?.image instanceof HTMLCanvasElement) {
        const ctx=map.image.getContext("2d")!;ctx.fillStyle="#f2e4c8";ctx.fillRect(0,0,640,64);ctx.fillStyle="#152c33";
        ctx.fillText(preview,320,32,608);map.needsUpdate=true;
      }
      visual.bubble.scale.set(340,46,1);visual.bubbleUntil=now+5000;this.scene.add(visual.bubble);
    }
  }
  private frame=(now:number)=>{
    this.raf=0;this.schedule();if(this.stopped||document.hidden)return;
    // Follow the display clock during play. A 16.67ms gate dropped ordinary
    // 16.5ms frames and produced alternating 30/60Hz motion on 60Hz displays.
    const interval=this.phase==="results"?250:0;
    if(this.cadence&&now-this.cadence<interval)return;
    const dt=this.previous?Math.min(.1,(now-this.previous)/1000):1/60;
    this.cadence=now;this.previous=now;
    recordFrame(now);
    const reduced=document.documentElement.dataset.motion==="reduced";
    const live=this.options.socket.snapshot;if(live)this.phase=live.room.phase;
    if(!this.options.socket.connected)this.localMotion.stop();
    const local=this.localMotion.step(dt,this.phase==="exploring"&&this.options.socket.connected),world=this.options.snapshot.world;
    for(const [id,visual] of this.players) {
      const position=id===this.options.localPlayerId?local:visual.motion.position(now,world);if(!position)continue;
      const dx=position.x-visual.x,dz=position.y-visual.z,moving=Math.hypot(dx,dz)>.08;
      visual.x=position.x;visual.z=position.y;
      visual.model.group.position.set(position.x,5,position.y);
      const swallowed=this.horror?.phase==="devouring"&&!this.horror.final&&this.horror.target_id===id;
      visual.model.group.scale.y=swallowed?.08:1;
      const walking=Math.hypot(dx,dz)/dt>8;
      if(walking){const angle=Math.atan2(dx,dz),current=visual.model.group.rotation.y;
        visual.model.group.rotation.y=current+Math.atan2(Math.sin(angle-current),Math.cos(angle-current))*(reduced?1:1-Math.exp(-dt/.085));}
      visual.model.animate(now,walking,reduced,dt);
      // Actual depth-tested geometry handles occlusion. Low cutaway walls must
      // not make a whole person vanish; eight witnesses fit the draw budget.
      const visible=true;
      visual.model.group.visible=visible;
      visual.label.visible=!swallowed&&Math.hypot(local.x-position.x,local.y-position.y)<900;
      visual.label.position.set(position.x,118,position.y);
      if(visual.bubble) {
        if(now>visual.bubbleUntil){this.disposeSprite(visual.bubble);visual.bubble=undefined;}
        else {visual.bubble.position.set(position.x,143,position.y);visual.bubble.visible=visible;}
      }
      if(id===this.options.localPlayerId&&moving&&now-this.lastFootstep>280){audioDirector.cue("step");this.lastFootstep=now;}
    }
    this.target.set(local.x,0,local.y);
    const guideId=this.options.guideTarget?.();
    const throughDoor=guideId==="cctv_terminal"&&local.y<920;
    const markerKey=guideId?guideId+(throughDoor?"-door":""):undefined;
    if(markerKey!==this.guideId){
      this.guideId=markerKey;let item=this.options.snapshot.interactables.find(item=>item.id===guideId);
      if(item&&throughDoor){
        const door=world.doors?.filter(door=>door.axis==="x"&&door.y===878).sort((a,b)=>Math.abs(a.x-item!.x)-Math.abs(b.x-item!.x))[0];
        if(door)item={...item,x:door.x,y:door.y};
      }
      this.guideRing.visible=this.guideLabel.visible=!!item;
      if(item){this.guideRing.position.set(item.x,8,item.y);this.guideLabel.position.set(item.x,110,item.y);}
    }
    if(this.phase==="reveal"&&live?.result&&live.reveal_started_at) {
      const step=Math.max(0,Math.min(5,Math.floor((Date.now()/1000-live.reveal_started_at)/4)));
      const event=live.result.comparisons[step]?.event, room=world.rooms.find(r=>r.name===event?.location);
      if(room){this.target.set(room.x+room.w/2,0,room.y+room.h/2);this.revealRing.visible=true;this.revealRing.position.set(this.target.x,7,this.target.z);}
      this.revealStep=step;
    } else if(this.revealStep!==-1){this.revealStep=-1;this.revealRing.visible=false;}
    this.cameraTarget.lerp(this.target,reduced?1:1-Math.exp(-dt/(this.phase==="reveal"?.35:.085)));
    this.camera.position.copy(this.cameraTarget).add(this.offset);this.camera.lookAt(this.cameraTarget);
    // Proximity/visibility remain tied to physical coordinates, not screen projection.
    if((this.tick++%3)===0) {
      let closest:Interactable|null=null,distance=88;
      if(this.phase==="exploring")for(const item of this.options.snapshot.interactables) {
        const physical=this.localMotion.state;
        const d=Math.max(Math.hypot(local.x-item.x,local.y-item.y),Math.hypot(physical.x-item.x,physical.y-item.y));
        if(d<distance&&hasLineOfSight(local.x,local.y,item.x,item.y,world.walls)&&hasLineOfSight(physical.x,physical.y,item.x,item.y,world.walls)){closest=item;distance=d;}
      }
      if((closest?.id??null)!==this.nearest){this.nearest=closest?.id??null;this.options.onPrompt(closest);}
      this.focusRing.visible=!!closest;if(closest)this.focusRing.position.set(closest.x,7,closest.y);
      const room=world.rooms.find(r=>local.x>=r.x&&local.x<=r.x+r.w&&local.y>=r.y&&local.y<=r.y+r.h)?.name??"Service Corridor";
      if(room!==this.room){this.room=room;this.options.onRoomChange(room);}
    }
    this.renderCreature(now,reduced,world);
    this.renderer?.render(this.scene,this.camera);
    if(!this.ready&&this.renderer){this.ready=true;this.options.onReady?.();}
    if(this.renderer&&now-this.metricsAt>1000) {
      const {render,memory}=this.renderer.info,canvas=this.renderer.domElement;
      canvas.dataset.drawCalls=String(render.calls);canvas.dataset.triangles=String(render.triangles);
      canvas.dataset.geometries=String(memory.geometries);canvas.dataset.textures=String(memory.textures);
      canvas.dataset.pixelRatio=this.renderer.getPixelRatio().toFixed(2);canvas.dataset.renderer="campus-3d";this.metricsAt=now;
      canvas.dataset.mapId=this.options.snapshot.room.map_id??"campus";canvas.dataset.witnesses=String(this.players.size);
    }
    // Lower backing resolution only after sustained slow frames, not a load spike.
    if(this.phase!=="results") {
      if(dt>.025)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);
      this.fastFrames=dt<.022?this.fastFrames+1:0;
    }
    if(this.slowFrames>120&&this.quality>.65){this.quality=Math.max(.65,this.quality-.2);this.slowFrames=0;this.resize();}
    if(this.fastFrames>450&&this.quality<1){this.quality=Math.min(1,this.quality+.1);this.fastFrames=0;this.resize();}
  };
  private creaturePlayer(pose:CreaturePose):PlayerState{return {...pose,id:"the-unsaid",name:"The Unsaid",color_index:0,ready:true,connected:true};}
  private renderCreature(now:number,reduced:boolean,world:RoomSnapshot["world"]){
    const preview=this.options.previewScare?.()??false;
    if(preview&&!this.maw){this.maw=new MemoryEater();this.scene.add(this.camera);this.camera.add(this.maw.group);}
    if(!this.maw)return;
    const state=this.horror,active=state?.phase==="hunting"||state?.phase==="devouring";
    const position=this.creatureMotion.position(now,world);
    if(this.creature)this.creature.group.visible=!!active&&!state?.final&&!!position;
    if(position&&this.creature){
      this.creature.group.position.set(position.x,3,position.y);
      const velocity=this.creatureMotion.velocity(now);
      if(Math.hypot(velocity.vx,velocity.vy)>4)this.creature.group.rotation.y=Math.atan2(velocity.vx,velocity.vy);
    }
    this.creature?.animate(now,state?.phase==="devouring",reduced);
    const closeup=(preview||(state?.phase==="devouring"&&(state.final||state.target_id===this.options.localPlayerId)))&&document.documentElement.dataset.scares!=="off";
    if(closeup&&!this.showingScare)this.scareAt=now;
    if(closeup!==this.showingScare){this.showingScare=!!closeup;if(this.renderer)this.renderer.domElement.dataset.scare=closeup?"devouring":"quiet";}
    this.maw.group.visible=!!closeup;
    if(closeup){
      const approach=reduced?1:Math.min(1,(now-this.scareAt)/260),maximum=Math.min(16,(this.camera.right-this.camera.left)/42),scale=maximum*(.45+approach*.55);
      this.maw.group.scale.setScalar(scale);this.maw.group.position.set(0,-104*scale,-600);
      this.maw.animate(now,true,reduced);
    }
  }
  private disposeSprite(sprite:T.Sprite) {this.scene.remove(sprite);sprite.material.map?.dispose();sprite.material.dispose();}
  private removePlayer(visual:Visual) {this.scene.remove(visual.model.group);visual.model.dispose();this.disposeSprite(visual.label);if(visual.bubble)this.disposeSprite(visual.bubble);}
  private disposeGraph(root:T.Object3D) {
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    root.traverse(object=>{
      if(object instanceof T.InstancedMesh)object.dispose();
      if(object instanceof T.Mesh||object instanceof T.LineSegments){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}
    });
    materials.forEach(material=>{if("map" in material&&material.map instanceof T.Texture)textures.add(material.map);material.dispose();});
    geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());root.clear();
  }
  dispose() {
    if(this.stopped)return;this.stopped=true;cancelAnimationFrame(this.raf);this.raf=0;
    this.off.forEach(off=>off());this.observer?.disconnect();document.removeEventListener("visibilitychange",this.visibility);
    this.renderer?.domElement.removeEventListener("webglcontextlost",this.contextLost);
    for(const visual of this.players.values())this.removePlayer(visual);this.players.clear();
    this.creature?.dispose();this.maw?.dispose();this.disposeGraph(this.scene);
    this.renderer?.dispose();this.renderer?.domElement.remove();this.renderer?.forceContextLoss();this.renderer=null;
  }
}
