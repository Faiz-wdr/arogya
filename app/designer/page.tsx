"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchAllPosterRequests,
  fetchPosterRequestWithItems,
  fetchActiveDoctors,
  PosterRequest,
  Doctor
} from "@/lib/services/db";
import {
  Calendar,
  FileCheck,
  Clock,
  UserCheck,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from "lucide-react";

export default function DesignerDashboard() {
  const [requests, setRequests] = useState<Omit<PosterRequest, "scheduleItems">[]>([]);
  const [activeDoctorsCount, setActiveDoctorsCount] = useState(0);
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
        const todayData = await fetchPosterRequestWithItems(todayStr);

        setRequests(allRequests);
        setActiveDoctorsCount(activeDocs.length);
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
      <div className="bg-white border border-slate-100 rounded-2xl py-24 flex flex-col items-center justify-center gap-2">
        <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold mt-1">Loading dashboard stats...</span>
      </div>
    );
  }

  // Calculate quick metrics
  const submittedCount = requests.filter((r) => r.status === "submitted").length;
  const completedCount = requests.filter((r) => r.status === "completed").length;
  const recentRequests = requests.slice(0, 5); // top 5 recent

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-xs text-slate-500">Monitor daily requests and database status</p>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Schedule Card */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 shadow-xs">
          <div className="flex justify-between items-center text-teal-600">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Schedule</span>
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800 capitalize">
              {todayRequest ? todayRequest.status : "No Draft"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
              {todayRequest ? `${todayRequest.doctorCount || 0} doctors scheduled` : "Not prepared yet"}
            </span>
          </div>
        </div>

        {/* Submitted Card */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 shadow-xs">
          <div className="flex justify-between items-center text-amber-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submitted Requests</span>
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-slate-850">{submittedCount}</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Pending processing</span>
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 shadow-xs">
          <div className="flex justify-between items-center text-teal-600">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Posters</span>
            <FileCheck className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-slate-850">{completedCount}</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Finished history</span>
          </div>
        </div>

        {/* Active Doctors Card */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 shadow-xs">
          <div className="flex justify-between items-center text-teal-600">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Doctors</span>
            <UserCheck className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-slate-850">{activeDoctorsCount}</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">Available for scheduling</span>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Recent Requests Log
          </h3>
          <Link
            href="/designer/requests"
            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3.5 rounded-full bg-teal-50/40 text-teal-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-slate-800 text-sm">No Poster Requests Found</h4>
              <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                When staff members submit doctor availability requests, they will show up here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentRequests.map((request) => (
              <Link
                key={request.date}
                href={`/designer/requests/${request.date}`}
                className="bg-white hover:bg-teal-50/20 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 text-left transition-all active:scale-[0.99] cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-50/70 text-teal-600 shrink-0">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-slate-800">
                      {new Date(request.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-medium">
                        By {request.createdByName || "Staff"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                        {request.doctorCount || 0} Doctors
                      </span>
                      {/* Status Badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          request.status === "completed"
                            ? "bg-teal-100/50 text-teal-700"
                            : request.status === "processing"
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : request.status === "submitted"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
