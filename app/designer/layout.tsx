"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Building2,
  Users,
  LogOut,
  Activity,
  UserCheck,
  Image as ImageIcon
} from "lucide-react";

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (profile && profile.role !== "designer") {
        // Only designers are allowed in the designer portal
        if (profile.role === "staff") {
          router.push("/staff/schedule");
        } else {
          router.push("/login");
        }
      }
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 text-teal-600 animate-pulse" />
          <span className="text-sm font-medium text-slate-500">Loading Designer Portal...</span>
        </div>
      </div>
    );
  }

  const menuItems = [
    { label: "Dashboard", href: "/designer", icon: LayoutDashboard },
    { label: "Requests", href: "/designer/requests", icon: FileText },
    { label: "Poster", href: "/designer/poster", icon: ImageIcon },
    { label: "Doctors", href: "/designer/doctors", icon: UserCheck },
    { label: "Departments", href: "/designer/departments", icon: Building2 },
    { label: "Staff Users", href: "/designer/staff", icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-teal-50/8 font-sans">
      {/* 1. Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 h-screen sticky top-0 justify-between py-6 px-4 shrink-0 shadow-xs">
        <div className="flex flex-col gap-8">
          {/* Logo Header */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-teal-50 text-teal-600">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 leading-tight">Arogya Portal</span>
              <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Designer Mode</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                    isActive
                      ? "bg-teal-50/50 text-teal-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Log Out */}
        <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 px-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-slate-800">{profile.name}</span>
            <span className="text-[10px] text-slate-400 font-medium truncate">{profile.email}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Mobile Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shadow-xs md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-teal-50 text-teal-600">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">Arogya Designer</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 md:py-6">
          {children}
        </main>
      </div>

      {/* 3. Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-lg px-2 py-2 md:hidden">
        <div className="flex items-center justify-around">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
                  isActive
                    ? "text-teal-600 font-bold"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[9px] tracking-wide uppercase font-semibold">
                  {item.label.split(" ")[0]} {/* Shorten "Staff Users" to "Staff" */}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
