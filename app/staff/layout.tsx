"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { Activity } from "lucide-react";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (profile && profile.role !== "staff") {
        if (profile.role === "designer") {
          router.push("/designer");
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
          <span className="text-sm font-medium text-slate-500">Loading Staff Portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-teal-50/8 pb-20 font-sans">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-teal-50 text-teal-600">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">Arogya Staff</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 uppercase tracking-wider">
            {profile.role}
          </span>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4">
        {children}
      </main>

      {/* Bottom Nav Bar */}
      <Navbar />
    </div>
  );
}
