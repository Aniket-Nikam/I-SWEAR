import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {GameMenu} from './GameMenu';
vi.mock('./GameSettings',()=>({GameSettings:()=>null}));
beforeEach(()=>{localStorage.clear();vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({account:null})})));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('offers a separate untimed tutorial without starting the timed demo',()=>{
 const enter=vi.fn(async()=>true);render(<GameMenu initialRoom="" error="" onEnter={enter}/>);
 fireEvent.click(screen.getByRole('button',{name:/New here\? Learn to investigate/}));
 expect(enter).not.toHaveBeenCalled();expect(screen.getByText(/No countdown, account or microphone/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Start guided tutorial'}));
 expect(enter).toHaveBeenCalledWith(expect.objectContaining({solo:true,tutorial:true,map_id:'campus'}));
});
it('requires a solo case selection and carries the selected map into entry',async()=>{
 const enter=vi.fn(async()=>true);render(<GameMenu initialRoom="" error="" onEnter={enter}/>);
 fireEvent.click(screen.getByRole('button',{name:/Play solo/}));expect(enter).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'The Last Signal Meridian Observatory'}));
 fireEvent.click(screen.getByRole('button',{name:'Begin rehearsal'}));
 expect(enter).toHaveBeenCalledWith(expect.objectContaining({solo:true,map_id:'observatory'}));
});
it('returns to solo setup after customizing the additional coat and headwear',async()=>{
 const enter=vi.fn(async()=>true);render(<GameMenu initialRoom="" error="" onEnter={enter}/>);
 fireEvent.click(screen.getByRole('button',{name:/Play solo/}));fireEvent.click(screen.getByRole('button',{name:'Customize your witness ↗'}));
 fireEvent.click(screen.getByRole('button',{name:'Plum coat'}));fireEvent.click(screen.getByRole('button',{name:'fedora'}));
 fireEvent.click(screen.getByRole('button',{name:"That's me"}));fireEvent.click(screen.getByRole('button',{name:'Begin rehearsal'}));
 expect(enter).toHaveBeenCalledWith(expect.objectContaining({solo:true,avatar_color:11,hat:'fedora'}));
});
