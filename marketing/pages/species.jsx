import dynamic from "next/dynamic";
function Loading(){return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#fafaf6",fontFamily:"monospace",fontSize:12,letterSpacing:"0.15em",color:"#40b070"}}>HEATWISE</div>;}
const C = dynamic(() => import("../components/marketing/SpeciesContent"), { ssr: false, loading: () => <Loading /> });
export default function Page() { return <C />; }
