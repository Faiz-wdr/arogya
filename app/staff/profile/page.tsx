"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { seedDatabase } from "@/lib/services/db";
import { LogOut, User, Mail, Shield, Database, Check, AlertCircle } from "lucide-react";

export default function ProfilePage() {
  const { profile, logout } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    const success = await seedDatabase();
    setSeeding(false);
    if (success) {
      setSeedResult({
        success: true,
        message: "Database seeded successfully with departments & doctors!",
      });
    } else {
      setSeedResult({
        success: false,
        message: "Failed to seed database. Check browser console.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-900">User Profile</h2>
        <p className="text-xs text-slate-500">Manage your session and configuration</p>
      </div>

      {/* User Information */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-teal-50 text-teal-600">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{profile?.name || "Hospital Staff"}</h3>
            <span className="text-xs text-slate-400">Arogya Staff Account</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4.5 w-4.5 text-slate-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Email Address</span>
              <span className="text-sm text-slate-800 font-medium">{profile?.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Shield className="h-4.5 w-4.5 text-slate-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Role Permissions</span>
              <span className="text-sm text-slate-800 font-medium capitalize">{profile?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Seeder for Development */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-teal-50/50 text-teal-600 shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h4 className="font-bold text-sm text-slate-900">Seed Database</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Populate departments and doctors for development testing.
            </p>
          </div>
        </div>

        {seedResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              seedResult.success
                ? "bg-teal-50 border-teal-100 text-teal-700"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            {seedResult.success ? (
              <Check className="h-4.5 w-4.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            )}
            <span>{seedResult.message}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding}
          className="w-full bg-teal-50 hover:bg-teal-100/80 disabled:bg-slate-50/50 text-teal-700 disabled:text-teal-400 font-semibold text-sm rounded-xl py-2.5 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer border border-teal-100/50"
        >
          {seeding ? (
            <div className="h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            "Run Seeder Now"
          )}
        </button>
      </div>

      {/* Log Out Action */}
      <button
        type="button"
        onClick={logout}
        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm rounded-xl py-3 border border-red-100/50 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
      >
        <LogOut className="h-4.5 w-4.5" />
        <span>Sign Out Account</span>
      </button>
    </div>
  );
}
