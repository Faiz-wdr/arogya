"use client";

import React from "react";
import { ScheduleItem } from "@/lib/services/db";
import { ArrowUp, ArrowDown, Edit2, Trash2, ShieldAlert } from "lucide-react";

interface ScheduleItemCardProps {
  item: ScheduleItem;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
}

// Helper to format time (e.g. "09:00" -> "9:00 AM")
function formatTime12(time24: string): string {
  if (!time24) return "";
  const [hourStr, minStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minStr} ${ampm}`;
}

export default function ScheduleItemCard({
  item,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ScheduleItemCardProps) {
  const isFixed = item.itemType === "fixed_service";

  if (isFixed) {
    return (
      <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4 flex justify-between items-center gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 uppercase tracking-wider">
              Fixed Service
            </span>
          </div>
          <h4 className="font-bold text-slate-800 text-sm">
            {item.departmentNameEnglish || "Physiotherapy & Rehabilitation"}
          </h4>
          <p className="text-xs text-slate-500 font-medium">Daily Outpatient Service</p>
          <div className="text-xs font-semibold text-teal-700 mt-0.5">
            {formatTime12(item.startTime)} - {formatTime12(item.endTime)}
          </div>
        </div>
        <div className="flex items-center justify-center p-2 text-teal-600 bg-teal-100/50 rounded-xl shrink-0">
          <ShieldAlert className="h-5 w-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
      <div className="flex-1 flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {item.departmentNameEnglish}
        </span>
        <h4 className="font-bold text-slate-900 text-sm">{item.doctorNameEnglish}</h4>
        <p className="text-xs text-slate-500 font-medium">{item.doctorQualificationEnglish}</p>
        <div className="text-xs font-bold text-teal-600 mt-1">
          {formatTime12(item.startTime)} - {formatTime12(item.endTime)}
        </div>
      </div>

      {/* Touch-friendly controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Reordering Controls */}
        <div className="flex flex-col gap-1 border-r border-slate-100 pr-2 mr-1">
          <button
            type="button"
            disabled={!onMoveUp}
            onClick={onMoveUp || undefined}
            className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-teal-50/30 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Move Up"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!onMoveDown}
            onClick={onMoveDown || undefined}
            className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-teal-50/30 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Move Down"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="p-2.5 rounded-xl border border-slate-100 text-slate-600 hover:bg-teal-50/30 transition-colors cursor-pointer"
            title="Edit Doctor"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2.5 rounded-xl border border-red-50 text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            title="Delete Doctor"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
