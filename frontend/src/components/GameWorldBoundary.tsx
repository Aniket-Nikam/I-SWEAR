import { Component, type ReactNode } from "react";

/** A deployed update or failed chunk request must leave a usable recovery UI. */
export class GameWorldBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    return <div className="world-load-error" role="alert"><section>
      <small>CASE FILE / CONNECTION CHECK</small><h2>The world couldn't open.</h2>
      <p>The game files may have changed or the download was interrupted. Reload this case to try again.</p>
      <button className="primary-action" onClick={()=>window.location.reload()}>Reload this case</button>
    </section></div>;
  }
}
