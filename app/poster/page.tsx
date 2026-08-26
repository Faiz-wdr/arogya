"use client";

import React from "react";
import PosterGenerator from "@/components/PosterGenerator";
import { Activity } from "lucide-react";
import Link from "next/link";

export default function PublicPosterPage() {
  return (
    <div className="min-h-screen bg-teal-50/8 font-sans flex flex-col">
      {/* Standalone Brand Header */}
      <header className="bg-white border-b border-slate-100 py-4 px-6 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2.5 max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-teal-50/80 text-teal-600">
            <Activity className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 leading-tight">Arogya Hospital</span>
            <span className="text-[10px] text-teal-650 font-bold uppercase tracking-wider">Services Portal</span>
          </div>
        </div>
      </header>

      {/* Viewport Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-10">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-8 shadow-xs">
          <PosterGenerator />
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="py-6 border-t border-slate-100 text-center text-xs text-slate-400 font-medium bg-white">
        © {new Date().getFullYear()} Arogya Hospital. All rights reserved.
      </footer>
    </div>
  );
}
