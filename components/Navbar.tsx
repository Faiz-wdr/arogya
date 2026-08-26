"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, History, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Schedule",
      href: "/staff/schedule",
      icon: CalendarCheck,
    },
    {
      label: "History",
      href: "/staff/history",
      icon: History,
    },
    {
      label: "Profile",
      href: "/staff/profile",
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-lg px-6 py-2 md:py-3">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
                isActive
                  ? "text-teal-600 font-semibold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="h-5.5 w-5.5" />
              <span className="text-[10px] tracking-wide uppercase">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
