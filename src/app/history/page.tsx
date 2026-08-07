"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  createdAt: string;
  input: { problem: string; code: string };
  result: unknown;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");

  async function loadHistory() {
    const response = await fetch("/api/history?limit=20");
    const payload = (await response.json()) as { items?: HistoryItem[]; error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? "无法读取历史记录。");
      return;
    }
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function remove(id: string) {
    const response = await fetch(`/api/history/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("删除失败。");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <main className="account-page">
      <h1>分析历史</h1>
      {error && <p role="alert">{error}</p>}
      {items.length === 0 ? <p>还没有已保存的分析。</p> : <ul>{items.map((item) => <li key={item.id}><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time><p>{item.input.problem}</p><button type="button" onClick={() => remove(item.id)}>删除</button></li>)}</ul>}
      <p><Link href="/analyze">开始新分析</Link> · <Link href="/profile">个人资料</Link></p>
    </main>
  );
}
