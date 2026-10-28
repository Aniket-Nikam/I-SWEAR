// @vitest-environment jsdom
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CaseLoading} from './CaseLoading';
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',(cb:()=>void)=>setTimeout(cb,16));vi.stubGlobal('cancelAnimationFrame',clearTimeout);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('never completes before the scene is ready and lets the completed bar paint',()=>{
 const finish=vi.fn();const view=render(<CaseLoading stage={25} onComplete={finish}/>);
 act(()=>vi.advanceTimersByTime(5000));expect(finish).not.toHaveBeenCalled();
 view.rerender(<CaseLoading stage={80} onComplete={finish}/>);act(()=>vi.advanceTimersByTime(5000));expect(finish).not.toHaveBeenCalled();
 view.rerender(<CaseLoading stage={100} onComplete={finish}/>);expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
 act(()=>vi.advanceTimersByTime(649));expect(finish).not.toHaveBeenCalled();act(()=>vi.advanceTimersByTime(1));expect(finish).toHaveBeenCalledTimes(1);
});
