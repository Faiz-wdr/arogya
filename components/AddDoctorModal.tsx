"use client";

import React, { useState, useEffect } from "react";
import { Department, Doctor, ScheduleItem } from "@/lib/services/db";
import { X, AlertTriangle, Info } from "lucide-react";

function isTimeOverlapping(s1: string, e1: string, s2: string, e2: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const start1 = toMins(s1);
  const end1 = toMins(e1);
  const start2 = toMins(s2);
  const end2 = toMins(e2);

  const crosses1 = start1 >= end1;
  const crosses2 = start2 >= end2;

  if (!crosses1 && !crosses2) {
    return start1 < end2 && start2 < end1;
  }
  if (crosses1 && !crosses2) {
    return !(start2 >= end1 && end2 <= start1);
  }
  if (!crosses1 && crosses2) {
    return !(start1 >= end2 && end1 <= start2);
  }
  // Both cross midnight
  return true;
}

interface AddDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">) => void;
  onEdit: (id: string, updatedItem: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">) => void;
  editingItem: ScheduleItem | null;
  departments: Department[];
  doctors: Doctor[];
  existingItems: ScheduleItem[];
}

export default function AddDoctorModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  editingItem,
  departments,
  doctors,
  existingItems,
}: AddDoctorModalProps) {
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [qualification, setQualification] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Custom doctor state
  const [isCustomDoctor, setIsCustomDoctor] = useState(false);
  const [customDoctorName, setCustomDoctorName] = useState("");
  const [customDoctorQualification, setCustomDoctorQualification] = useState("");

  // Filter doctors based on selected department
  const filteredDoctors = doctors.filter((doc) => doc.departmentId === departmentId);

  // Populate form if editing
  useEffect(() => {
    if (editingItem) {
      setDepartmentId(editingItem.departmentId);
      setDoctorId(editingItem.doctorId || "");
      setStartTime(editingItem.startTime);
      setEndTime(editingItem.endTime);
      if (editingItem.doctorId === null && editingItem.itemType === "doctor") {
        setIsCustomDoctor(true);
        setCustomDoctorName(editingItem.doctorNameMalayalamUnicode || "");
        setCustomDoctorQualification(editingItem.doctorQualificationEnglish || "");
      } else {
        setIsCustomDoctor(false);
        setCustomDoctorName("");
        setCustomDoctorQualification("");
      }
    } else {
      // Defaults
      setDepartmentId("");
      setDoctorId("");
      setQualification("");
      setStartTime("09:00");
      setEndTime("13:00");
      setIsCustomDoctor(false);
      setCustomDoctorName("");
      setCustomDoctorQualification("");
    }
    setError(null);
    setWarning(null);
  }, [editingItem, isOpen]);

  // Update qualification automatically when doctor changes
  useEffect(() => {
    if (doctorId && !isCustomDoctor) {
      const docObj = doctors.find((d) => d.id === doctorId);
      setQualification(docObj ? docObj.qualificationEnglish : "");
    } else if (!isCustomDoctor) {
      setQualification("");
    }
  }, [doctorId, doctors, isCustomDoctor]);

  // Perform checks and update warnings/errors in real time
  useEffect(() => {
    setError(null);
    setWarning(null);

    if (isCustomDoctor) {
      if (!customDoctorName.trim() || !startTime || !endTime) return;
      if (startTime === endTime) {
        setError("Start time and end time cannot be equal.");
        return;
      }
      return;
    }

    if (!doctorId || !startTime || !endTime) return;

    if (startTime === endTime) {
      setError("Start time and end time cannot be equal.");
      return;
    }

    // Check duplicates and overlaps
    const otherShiftsForDoctor = existingItems.filter(
      (item) =>
        item.itemType === "doctor" &&
        item.doctorId === doctorId &&
        item.id !== editingItem?.id
    );

    if (otherShiftsForDoctor.length > 0) {
      // Accidental duplicate warning
      setWarning("This doctor is already scheduled for another shift on this date.");

      // Check overlap
      const hasOverlap = otherShiftsForDoctor.some((other) => {
        return isTimeOverlapping(startTime, endTime, other.startTime, other.endTime);
      });

      if (hasOverlap) {
        setError("Time range overlaps with the doctor's existing shift.");
      }
    }
  }, [doctorId, startTime, endTime, existingItems, editingItem, isCustomDoctor, customDoctorName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!departmentId) {
      setError("Please select a department.");
      return;
    }
    if (!doctorId && !isCustomDoctor) {
      setError("Please select a doctor.");
      return;
    }
    if (isCustomDoctor && !customDoctorName.trim()) {
      setError("Please enter a custom doctor name.");
      return;
    }
    if (startTime === endTime) {
      setError("Start time and end time cannot be equal.");
      return;
    }

    if (!isCustomDoctor) {
      // Double check overlap error to block submission
      const otherShiftsForDoctor = existingItems.filter(
        (item) =>
          item.itemType === "doctor" &&
          item.doctorId === doctorId &&
          item.id !== editingItem?.id
      );
      const hasOverlap = otherShiftsForDoctor.some((other) => {
        return isTimeOverlapping(startTime, endTime, other.startTime, other.endTime);
      });

      if (hasOverlap) {
        setError("Time range overlaps with the doctor's existing shift.");
        return;
      }
    }

    const payload: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt"> = {
      doctorId: isCustomDoctor ? null : doctorId,
      departmentId,
      startTime,
      endTime,
      displayOrder: editingItem ? editingItem.displayOrder : existingItems.length,
      itemType: "doctor",
      ...(isCustomDoctor ? {
        doctorNameMalayalamUnicode: customDoctorName,
        doctorQualificationEnglish: customDoctorQualification,
      } : {})
    };

    if (editingItem) {
      onEdit(editingItem.id, payload);
    } else {
      onAdd(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">
            {editingItem ? "Edit Schedule Item" : "Add Doctor Availability"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-teal-50/30 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          
          {/* Validation Messages */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 flex items-start gap-2 animate-shake">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {warning && !error && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700 flex items-start gap-2">
              <Info className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
              <span>{warning}</span>
            </div>
          )}

          {/* Department Selection */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dept" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Department
            </label>
            <select
              id="dept"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setDoctorId(""); // Reset doctor selection
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
              required
            >
              <option value="">Select Department</option>
              {departments
                // Filter out the fixed service department for manual addition
                .filter((d) => d.id !== "dept_physiotherapy")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameEnglish}
                  </option>
                ))}
            </select>
          </div>

          {/* Doctor Selection */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Doctor
            </label>
            <select
              id="doc"
              value={isCustomDoctor ? "custom_doctor" : doctorId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom_doctor") {
                  setIsCustomDoctor(true);
                  setDoctorId("");
                } else {
                  setIsCustomDoctor(false);
                  setDoctorId(val);
                }
              }}
              disabled={!departmentId}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white disabled:bg-teal-50/10 disabled:text-slate-400 h-11"
              required
            >
              <option value="">Select Doctor</option>
              {filteredDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameEnglish}
                </option>
              ))}
              <option value="custom_doctor">+ Enter Custom Doctor Name</option>
            </select>
          </div>

          {/* Custom Doctor Name & Qualification Inputs */}
          {isCustomDoctor ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customName" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Custom Doctor Name (Malayalam)
                </label>
                <input
                  id="customName"
                  type="text"
                  value={customDoctorName}
                  onChange={(e) => setCustomDoctorName(e.target.value)}
                  placeholder="e.g. ഡോ. പുതിയ ഡോക്ടർ"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="customQual" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Custom Qualification
                </label>
                <input
                  id="customQual"
                  type="text"
                  value={customDoctorQualification}
                  onChange={(e) => setCustomDoctorQualification(e.target.value)}
                  placeholder="e.g. MBBS, MD"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                />
              </div>
            </>
          ) : (
            /* Qualification Display */
            <div className="flex flex-col gap-1.5">
              <label htmlFor="qualification" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Qualification (Auto-filled)
              </label>
              <input
                id="qualification"
                type="text"
                readOnly
                value={qualification}
                placeholder="Select a doctor to view qualification"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-teal-50/20 text-teal-700/70 text-sm h-11 focus:outline-none"
              />
            </div>
          )}

          {/* Time Picker */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="start" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Start Time
              </label>
              <input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="end" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                End Time
              </label>
              <input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4 shrink-0 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-teal-50/30 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl py-3 transition-colors cursor-pointer h-11 flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!error}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-sm rounded-xl py-3 transition-all cursor-pointer h-11 flex items-center justify-center"
            >
              {editingItem ? "Save Changes" : "Add to Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
