import { Ic } from "./Icon";
import { T } from "../theme";

export const BottomNav = ({ active, navigate }) => {
  const items = [
    { id: "home",      n: "home",    l: "Home"    },
    { id: "cityHeat",  n: "globe",   l: "Explore" },
    { id: "create",    n: "scan",    l: "Scan",  fab: true },
    { id: "impact",    n: "leaf",    l: "Impact"  },
    { id: "settings",  n: "cog",     l: "Settings"},
  ];

  return (
    <div style={{
      position:'relative',
      paddingBottom:'env(safe-area-inset-bottom, 0px)',
      background:'rgba(4,8,22,0.98)',
      backdropFilter:'blur(24px)',
      WebkitBackdropFilter:'blur(24px)',
      borderTop:'1px solid rgba(56,189,248,0.18)',
      display:'flex',zIndex:100,
      width:'100%',
    }}>
      {items.map(({ id, n, l, fab }) => {
        const on = active === id || (id==='create' && ['measure','environment','analysis','photoCapture','photoMeasureAR','liveARMeasure'].includes(active));
        if (fab) {
          return (
            <div key={id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,paddingTop:6,paddingBottom:6,cursor:'pointer'}} onClick={() => navigate(id)}>
              <div style={{
                width:46,height:46,borderRadius:15,
                background:on?'linear-gradient(135deg,#0C4A6E,#38BDF8)':'linear-gradient(135deg,#0A1E3A,#0C4A6E)',
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:on?'0 4px 18px rgba(56,189,248,.60)':'0 2px 8px rgba(56,189,248,.22)',
                transition:'all .22s ease',
                border:'1px solid rgba(56,189,248,.50)',
              }}>
                <Ic n={n} s={20} c={on?"#E0F2FE":"#38BDF8"} />
              </div>
              <span style={{fontSize:9,letterSpacing:'.4px',color:on?T.green:'rgba(56,189,248,.65)',fontWeight:700,fontFamily:"'DM Sans',sans-serif",transition:'color .2s'}}>
                {l}
              </span>
            </div>
          );
        }
        return (
          <div key={id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,paddingTop:6,paddingBottom:6,cursor:'pointer',position:'relative',transition:'all .2s'}}
            onClick={() => navigate(id)}>
            {on && (
              <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:28,height:2,background:'linear-gradient(90deg,#0C4A6E,#38BDF8)',borderRadius:2}}/>
            )}
            <Ic n={n} s={22} c={on ? T.green : "rgba(56,189,248,.50)"} />
            <span style={{fontSize:9,letterSpacing:'.4px',color:on?T.green:'rgba(186,230,253,.55)',fontWeight:on?700:500,fontFamily:"'DM Sans',sans-serif",transition:'color .2s'}}>
              {l}
            </span>
          </div>
        );
      })}
    </div>
  );
};
