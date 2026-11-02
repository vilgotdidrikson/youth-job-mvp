"use client";
import { useState } from "react";
import Link from "next/link";
import { PrelaunchDemo } from "@/components/prelaunch-demo";
import type { Audience } from "@/lib/prelaunch";
import "../prelaunch.css";
export default function DemoPage() {
  const [role, setRole] = useState<Audience>("youth");
  return <main className="pl-page pl-demo-page"><header className="pl-demo-header"><Link href="/">← Till intresseanmälan</Link><span>MatchnWork · Demo</span></header><section className="pl-demo-intro"><span className="pl-eyebrow">EN FÖRHANDSTITT</span><h1>Prova nästa steg.</h1><p>Byt mellan ungdom och företag. Upptäck jobb, prova en ansökan och testa chatten med fiktiva exempel.</p></section><div className="pl-demo-stage"><PrelaunchDemo role={role} setRole={setRole} /></div><div className="pl-demo-ending"><p>Vill du veta när vi öppnar?</p><Link className="pl-button" href="/">Skriv upp dig <span>↗</span></Link></div></main>;
}
