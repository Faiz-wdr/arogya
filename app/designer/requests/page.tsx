"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchAllPosterRequests, PosterRequest, deletePosterRequest } from "@/lib/services/db";
import { Calendar, ChevronRight, Filter, AlertCircle, FileSpreadsheet, Clock, Trash2, Plus, X } from "lucide-react";

export default function PosterRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<Omit<PosterRequest, "scheduleItems">[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  // Create New Schedule State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newScheduleDate, setNewScheduleDate] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPosterRequests();
      setRequests(data);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Filter logic
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = selectedStatus ? req.status === selectedStatus : true;
    const matchesDate = selectedDate ? req.date === selectedDate : true;
    return matchesStatus && matchesDate;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900">Poster Requests Log</h2>
          <p className="text-xs text-slate-500">Track, edit, and update the status of schedule posters</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewScheduleDate(new Date().toISOString().split("T")[0]);
            setIsCreateModalOpen(true);
          }}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors h-10 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Schedule</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Status Dropdown */}
        <div className="relative flex items-center">
          <Filter className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D9D9D9] focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm bg-white text-slate-700 h-11 appearance-none"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="relative flex items-center">
          <Calendar className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D9D9D9] focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm bg-white text-slate-700 h-11 cursor-pointer"
          />
        </div>
      </div>

      {/* Clear Filter Indicator */}
      {(selectedStatus || selectedDate) && (
        <button
          type="button"
          onClick={() => {
            setSelectedStatus("");
            setSelectedDate("");
          }}
          className="text-xs font-semibold text-teal-600 hover:text-teal-700 self-start cursor-pointer hover:underline -mt-3 pl-1"
        >
          Clear filters
        </button>
      )}

      {/* Requests Logs */}
      {loading ? (
        <div className="bg-white border border-[#D9D9D9] rounded-2xl py-16 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold mt-1">Loading poster requests...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-[#D9D9D9] rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3.5 rounded-full bg-teal-50/40 text-teal-600">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-slate-800 text-sm">No Poster Requests found</h4>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              No daily schedules match the selected filters or have been created in the database.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredRequests.map((request) => (
            <div
              key={request.date}
              className="bg-white border border-[#D9D9D9] rounded-2xl flex items-center justify-between overflow-hidden shadow-xs hover:shadow-sm transition-all"
            >
              <Link
                href={`/designer/requests/${request.date}`}
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
                    
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium">
                        By {request.createdByName || "Staff"}
                      </span>
                      <span className="text-[10px] text-slate-450 font-semibold bg-slate-50 border border-[#D9D9D9] px-1.5 py-0.5 rounded">
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

              {/* Delete Button */}
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  if (window.confirm(`Are you sure you want to delete the schedule request for ${request.date}? This action cannot be undone.`)) {
                    try {
                      setLoading(true);
                      await deletePosterRequest(request.date);
                      await loadRequests();
                    } catch (err) {
                      console.error("Failed to delete request:", err);
                      alert("Failed to delete request. Please try again.");
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="p-4 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border-l border-[#D9D9D9] shrink-0 self-stretch flex items-center justify-center cursor-pointer border-none bg-transparent w-14"
                title="Delete Request"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Create New Schedule Dialog Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#D9D9D9] p-6 flex flex-col gap-4 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Create New Schedule</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Select a date to create a new daily poster schedule without waiting for a staff request.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="newScheduleDate" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select Date
              </label>
              <input
                id="newScheduleDate"
                type="date"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D9D9D9] focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11 cursor-pointer"
                required
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-[#D9D9D9] text-slate-700 font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newScheduleDate}
                onClick={() => {
                  setIsCreateModalOpen(false);
                  router.push(`/designer/requests/${newScheduleDate}`);
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
