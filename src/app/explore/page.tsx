import { DiagnosticExplorer } from "@/components/diagnostic-explorer";
import { SiteHeader } from "@/components/site-header";

export default function ExplorePage() {
  return (
    <main className="explore-page">
      <SiteHeader compact />

      <section className="explore-intro">
        <p>THE CORE OF YOURTHINKINGSTYLE</p>
        <h1>
          不急着替你解题。
          <br />
          先把你的推理看清楚。
        </h1>
      </section>

      <DiagnosticExplorer />
    </main>
  );
}
