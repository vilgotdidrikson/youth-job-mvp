import type { Metadata } from "next";
import { PrelaunchDemo } from "@/components/prelaunch-demo";
import "./workspace.css";
import "./youth.css";
import "mapbox-gl/dist/mapbox-gl.css";
export const metadata: Metadata = {
  title: "Testa MatchnWork – interaktiv demo",
  description:
    "Prova att upptäcka jobb, ansöka, granska kandidater och chatta i MatchnWorks fiktiva demo.",
};
export default function DemoPage() {
  return <PrelaunchDemo />;
}
