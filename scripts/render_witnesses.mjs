/** Render game meshes once into lightweight lobby/results portraits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const {JSDOM}=require('jsdom'), ts=require('typescript'), T=require('three');
const sharp=createRequire(import.meta.url)(process.argv[2]||'sharp');
globalThis.document=new JSDOM('<!doctype html>').window.document;
const source=await fs.readFile(path.join(root,'frontend/src/game/campus3d/Art.ts'),'utf8');
const built=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('require','module','exports',built)(require,mod,mod.exports);
const {WitnessModel}=mod.exports;
const {SVGRenderer}=await import(pathToFileURL(path.join(root,'frontend/node_modules/three/examples/jsm/renderers/SVGRenderer.js')).href);
const colors=[0xef805f,0xa9cfbd,0xe8be69,0xb3a1c9,0x80a5c6,0xdf9baf,0x91ab77,0xc6b5a0,0x5275a0,0xb36c48,0xeee1c6,0x795875];
const hats=['none','beanie','cap','headphones','glasses','beret','fedora','visor'];
const directory=path.join(root,'frontend/public/art/witnesses');await fs.mkdir(directory,{recursive:true});
for(let color=0;color<colors.length;color++)for(const hat of hats){
 const scene=new T.Scene(), model=new WitnessModel(colors[color],hat);scene.add(model.group);
 scene.add(new T.HemisphereLight(0xffefd0,0x496369,2.3));const sun=new T.DirectionalLight(0xffe2ad,2.1);sun.position.set(-100,180,140);scene.add(sun);
 const camera=new T.OrthographicCamera(-47,47,60,-60,.1,1000);camera.position.set(100,100,260);camera.lookAt(0,47,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 const renderer=new SVGRenderer();renderer.setSize(280,360);renderer.setClearColor(0,0);renderer.render(scene,camera);
 await sharp(Buffer.from(renderer.domElement.outerHTML)).webp({quality:88}).toFile(path.join(directory,`${color}-${hat}.webp`));model.dispose();
}
console.log('Rendered 96 portraits from the game mesh.');
