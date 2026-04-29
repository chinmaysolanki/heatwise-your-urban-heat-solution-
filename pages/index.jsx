import dynamic from "next/dynamic";

const HeatWiseApp = dynamic(() => import("@/components/HeatWiseApp"), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  return <HeatWiseApp />;
}
