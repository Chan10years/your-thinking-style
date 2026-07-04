"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { primaryNavigation } from "@/lib/site-content";

import { BrandMark } from "./brand-mark";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className={`site-header ${compact ? "site-header--compact" : ""}`}>
        <BrandMark compact={compact} />
        <button
          type="button"
          className="site-header__menu"
          aria-expanded={isOpen}
          aria-controls="site-navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "关闭" : "菜单"}
        </button>
      </header>

      <div
        className={`site-menu ${isOpen ? "site-menu--open" : ""}`}
        aria-hidden={!isOpen}
      >
        <nav id="site-navigation" aria-label="主要导航">
          {primaryNavigation.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              tabIndex={isOpen ? 0 : -1}
              className={pathname === item.href ? "is-current" : ""}
              onClick={() => setIsOpen(false)}
            >
              <span>0{index + 1}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <p>
          先看懂你的思路，
          <br />
          再修正代码真正偏离的位置。
        </p>
      </div>
    </>
  );
}
