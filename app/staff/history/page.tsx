"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchPosterRequestsHistory, PosterRequest, deletePosterRequest } from "@/lib/services/db";
import { Calendar, ChevronRight, Activity, Clock, Users, Trash2 } from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<Omit<PosterRequest, "scheduleItems">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await fetchPosterRequestsHistory();
        setHistory(data);
      } catch (error) {
        console.error("Error loading history:", error);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const handleOpenDate = (dateString: string) => {
    router.push(`/staff/schedule?date=${dateString}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-900">Submission History</h2>
        <p className="text-xs text-slate-500">View and reopen previously created schedules</p>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold mt-1">Loading history list...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3.5 rounded-full bg-teal-50/40 text-teal-600">
            <Clock className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-slate-800 text-sm">No History Yet</h4>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              When you submit daily doctor schedules, they will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((request) => (
            <div
              key={request.date}
              className="bg-white border border-slate-100 rounded-2xl flex items-center justify-between overflow-hidden shadow-xs hover:shadow-sm transition-all"
            >
              <button
                type="button"
                onClick={() => handleOpenDate(request.date)}
                className="flex-1 p-4 flex items-center justify-between gap-4 text-left transition-all hover:bg-teal-50/20 cursor-pointer border-none bg-transparent"
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
                      {/* Doctor Count Badge */}
                      <span className="text-[10px] text-teal-700 flex items-center gap-1 font-medium bg-teal-50/30 border border-teal-100/30 px-2 py-0.5 rounded-md">
                        <Users className="h-3 w-3 text-teal-500" />
                        <span>{request.doctorCount || 0} Doctors</span>
                      </span>
                      
                      {/* Status Badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          request.status === "submitted"
                            ? "bg-teal-50 border border-teal-100 text-teal-700"
                            : "bg-teal-50/20 border border-teal-100/30 text-teal-700"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to delete the schedule request for ${request.date}? This action cannot be undone.`)) {
                    try {
                      setLoading(true);
                      await deletePosterRequest(request.date);
                      const data = await fetchPosterRequestsHistory();
                      setHistory(data);
                    } catch (err) {
                      console.error("Failed to delete request:", err);
                      alert("Failed to delete request. Please try again.");
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="p-4 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border-l border-slate-100 shrink-0 self-stretch flex items-center justify-center cursor-pointer border-none bg-transparent w-14"
                title="Delete Request"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
