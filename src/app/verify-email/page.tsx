import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <main className="account-page">
      <h1>邮箱验证</h1>
      <p>请打开验证邮件中的链接。验证完成后可以登录并开始分析。</p>
      <p><Link href="/login">去登录</Link></p>
    </main>
  );
}
