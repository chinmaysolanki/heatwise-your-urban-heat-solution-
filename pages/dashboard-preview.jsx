import { HomeDashboardLight } from "@/components/heatwise/HomeDashboardLight";

export default function DashboardPreview() {
  return (
    <HomeDashboardLight
      navigate={(screen) => console.log("navigate →", screen)}
    />
  );
}
