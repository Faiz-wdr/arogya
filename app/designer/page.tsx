"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchAllPosterRequests,
  fetchPosterRequestWithItems,
  fetchActiveDoctors,
  fetchAllDepartments,
  PosterRequest,
} from "@/lib/services/db";
import {
  Calendar,
  Building2,
  CheckCircle2,
  Users,
  ChevronRight,
  Plus,
  Sparkles,
  FileText
} from "lucide-react";

export default function DesignerDashboard() {
  const [requests, setRequests] = useState<Omit<PosterRequest, "scheduleItems">[]>([]);
  const [activeDoctorsCount, setActiveDoctorsCount] = useState(0);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [todayRequest, setTodayRequest] = useState<PosterRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const todayStr = getTodayDateString();
        const allRequests = await fetchAllPosterRequests();
        const activeDocs = await fetchActiveDoctors();
        const allDepts = await fetchAllDepartments();
        const todayData = await fetchPosterRequestWithItems(todayStr);

        setRequests(allRequests);
        setActiveDoctorsCount(activeDocs.length);
        setDepartmentsCount(allDepts.length);
        setTodayRequest(todayData);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl py-24 flex flex-col items-center justify-center gap-3 shadow-2xs">
        <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-medium">Loading overview...</span>
      </div>
    );
  }

  // Quick metrics
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const recentRequests = requests.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/designer/requests"
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs h-9 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-slate-500" />
            <span>New Schedule</span>
          </Link>
          <Link
            href="/designer/poster"
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs h-9 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Create Poster</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Today's Schedule Status */}
        <div className="bg-white border border-slate-200/70 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Today's Schedule</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-base font-bold text-slate-800 capitalize">
              {todayRequest ? todayRequest.status : "No Schedule"}
            </div>
          </div>
        </div>

        {/* Departments */}
        <div className="bg-white border border-slate-200/70 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Departments</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{departmentsCount}</div>
          </div>
        </div>

        {/* Completed Posters */}
        <div className="bg-white border border-slate-200/70 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Completed</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{completedCount}</div>
          </div>
        </div>

        {/* Active Doctors */}
        <div className="bg-white border border-slate-200/70 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Active Doctors</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{activeDoctorsCount}</div>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Requests</h2>
          <Link
            href="/designer/requests"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
            <FileText className="h-8 w-8 text-slate-300 stroke-[1.5]" />
            <span className="text-xs font-medium text-slate-400">No requests submitted yet</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentRequests.map((request) => {
              const reqDate = new Date(request.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <Link
                  key={request.date}
                  href={`/designer/requests/${request.date}`}
                  className="py-3 flex items-center justify-between gap-4 group cursor-pointer transition-colors first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">
                        {reqDate}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {request.createdByName && request.createdByName !== "Staff" && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {request.createdByName}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {request.doctorCount || 0} doctors
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${
                        request.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : request.status === "processing"
                          ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                          : request.status === "submitted"
                          ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {request.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


