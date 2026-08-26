"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchStaffUsers, updateUserActiveStatus, StaffUserProfile } from "@/lib/services/db";
import {
  Users,
  Shield,
  User,
  Power,
  Activity,
  AlertCircle
} from "lucide-react";

export default function StaffUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchStaffUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleActive = async (uid: string, currentStatus: boolean) => {
    // Current user safety check
    if (currentUser && currentUser.uid === uid) {
      setError("Safeguard Alert: You cannot deactivate your own administrative designer account.");
      setTimeout(() => setError(null), 4000);
      return;
    }

    setTogglingUid(uid);
    try {
      await updateUserActiveStatus(uid, !currentStatus);
      setUsers(
        users.map((u) => (u.uid === uid ? { ...u, isActive: !currentStatus } : u))
      );
    } catch (error) {
      console.error("Failed to toggle active status:", error);
      setError("Failed to update user status. Please try again.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setTogglingUid(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-900">Staff User Management</h2>
        <p className="text-xs text-slate-500">Authorize or suspend system access credentials</p>
      </div>

      {/* Safety Alert Banners */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700 flex items-start gap-2 animate-shake">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Users List Cards */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-16 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold mt-1">Loading system users...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3.5 rounded-full bg-teal-50/40 text-teal-600">
            <Users className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-slate-800 text-sm">No Users Found</h4>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              No staff accounts exist in the Firestore database.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((staffMember) => {
            const isSelf = currentUser?.uid === staffMember.uid;
            
            return (
              <div
                key={staffMember.uid}
                className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  {/* Role Icon */}
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${
                      staffMember.role === "designer"
                        ? "bg-teal-50 text-teal-600"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    {staffMember.role === "designer" ? (
                      <Shield className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 leading-tight">
                        {staffMember.name}
                      </span>
                      {isSelf && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                      {staffMember.email}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize mt-0.5 font-semibold">
                      Role: {staffMember.role}
                    </span>
                  </div>
                </div>

                {/* Status Toggle Button */}
                <button
                  type="button"
                  disabled={isSelf || togglingUid === staffMember.uid}
                  onClick={() => handleToggleActive(staffMember.uid, staffMember.isActive)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                    staffMember.isActive
                      ? "bg-teal-50 border-teal-100 text-teal-700 hover:bg-teal-100/50"
                      : "bg-red-50 border-red-100 text-red-750 hover:bg-red-100/50"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {togglingUid === staffMember.uid ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Power className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {staffMember.isActive ? "Suspend" : "Activate"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
