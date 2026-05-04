import dynamic from "next/dynamic";

function Loading() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"#fafaf6",
      fontFamily:"'JetBrains Mono',monospace", fontSize:12,
      letterSpacing:"0.15em", color:"#40b070" }}>
      HEATWISE
    </div>
  );
}

const Content = dynamic(
  () => import("@/components/marketing/BlogContent"),
  { ssr: false, loading: () => <Loading /> }
);

export default function Page() { return <Content />; }
