"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link href={href} className={`sidebar-link ${isActive ? "active" : ""}`}>
      <span className="shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
      {children}
    </Link>
  );
}
