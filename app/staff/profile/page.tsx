"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User, Mail, Shield } from "lucide-react";

export default function ProfilePage() {
  const { profile, logout } = useAuth();

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
