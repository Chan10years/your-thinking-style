import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { getAppEdition } from "@/config/edition";
import AnalyzePage from "./analyze/page";

export const dynamic = "force-dynamic";

export default function Home() {
  if (getAppEdition() === "local") {
    return <AnalyzePage />;
  }

  return (
    <main className="landing-page">
      <SiteHeader />

      <section className="landing-hero">
        <p className="landing-hero__eyebrow">
          HELLO, THIS IS YOUR THINKING STYLE.
        </p>

        <h1>
          <span>看懂你的思路</span>
          <span>再看代码</span>
          <span>哪里偏离</span>
        </h1>

        <div className="landing-hero__note">
          <p>
            不是直接给出标准答案。
            <br />
            从你为什么这样写开始，找出思路与实现之间真正的断点。
          </p>
        </div>

        <Link href="/analyze" className="landing-journey">
          <span className="landing-journey__signature">
            YourThinking
            <br />
            Style
          </span>
          <span>开始分析</span>
        </Link>
      </section>
    </main>
  );
}
