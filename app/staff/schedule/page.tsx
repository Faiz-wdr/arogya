"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Department,
  Doctor,
  ScheduleItem,
  fetchActiveDepartments,
  fetchActiveDoctors,
  fetchPosterRequestWithItems,
  savePosterRequest,
  saveDoctor,
} from "@/lib/services/db";
import ScheduleItemCard from "@/components/ScheduleItemCard";
import AddDoctorModal from "@/components/AddDoctorModal";
import { Calendar, Plus, Save, CheckCircle, Activity, AlertCircle, X, ArrowUp, ArrowDown, Edit2, Trash2 } from "lucide-react";
import { parseSchedule } from "@/lib/utils/scheduleParser";

function ScheduleContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  // Date State
  const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTomorrowDateString());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [status, setStatus] = useState<"draft" | "submitted" | "processing" | "completed">("draft");
  
  // Master Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  // Loading & Action States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPhysiotherapy, setShowPhysiotherapy] = useState<boolean>(true);

  // Phase 4 Bulk Import States
  const [pastedText, setPastedText] = useState("");
  const isReviewing = false;
  const setIsReviewing = (val: boolean) => {};
  const reviewDate = "";
  const setReviewDate = (val: string) => {};
  const reviewItems: any[] = [];
  const setReviewItems = (val: any) => {};
  const handleAddReviewItem = () => {};
  const handleConfirmReview = async () => {};

  const [duplicateCheck, setDuplicateCheck] = useState<{
    showDialog: boolean;
    date: string;
    existingStatus: "draft" | "submitted" | "processing" | "completed";
    parsedItems: any[];
  } | null>(null);

  // Master Doctor Quick Add State
  const [isAddMasterDocOpen, setAddMasterDocOpen] = useState(false);
  const [masterDocForm, setMasterDocForm] = useState<{
    nameEnglish: string;
    nameMalayalamMVM: string;
    qualificationEnglish: string;
    departmentId: string;
    reviewIndex: number | null;
  }>({
    nameEnglish: "",
    nameMalayalamMVM: "",
    qualificationEnglish: "",
    departmentId: "",
    reviewIndex: null
  });

  // Read date from query param if available
  useEffect(() => {
    if (dateParam) {
      setSelectedDate(dateParam);
    }
  }, [dateParam]);

  // Helper to determine day of week (0 = Sunday, 1 = Monday, etc.)
  const getDayOfWeek = (dateString: string) => {
    if (!dateString) return 1;
    const parts = dateString.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const localDate = new Date(year, month, day);
    return localDate.getDay();
  };

  // Load master data (departments & doctors) once
  useEffect(() => {
    async function loadMasterData() {
      try {
        const deptsData = await fetchActiveDepartments();
        const docsData = await fetchActiveDoctors();
        setDepartments(deptsData);
        setDoctors(docsData);
      } catch (error) {
        console.error("Error loading master data:", error);
      }
    }
    loadMasterData();
  }, []);

  // Fetch or initialize schedule whenever date changes
  useEffect(() => {
    if (!selectedDate) return;

    async function loadSchedule() {
      setLoading(true);
      setSubmitError(null);
      try {
        const posterRequest = await fetchPosterRequestWithItems(selectedDate);
        const day = getDayOfWeek(selectedDate);
        const isWeekday = day !== 0; // Monday to Saturday

        if (posterRequest) {
          setStatus(posterRequest.status);
          setShowPhysiotherapy(posterRequest.showPhysiotherapy !== undefined ? posterRequest.showPhysiotherapy : true);
          
          let items = posterRequest.scheduleItems || [];
          
          // Verify if fixed service needs to be auto-injected (if weekday and missing)
          const hasFixedService = items.some((item) => item.itemType === "fixed_service");
          if (isWeekday && !hasFixedService) {
            const fixedItem: ScheduleItem = {
              id: "fixed_physio",
              doctorId: null,
              departmentId: "dept_physiotherapy",
              startTime: "09:00",
              endTime: "17:00",
              displayOrder: items.length,
              itemType: "fixed_service",
            };
            items = [...items, fixedItem];
          } else if (!isWeekday && hasFixedService) {
            // Remove fixed service on Sunday if it accidentally exists
            items = items.filter((item) => item.itemType !== "fixed_service");
          }
          
          // Sort items by displayOrder
          items.sort((a, b) => a.displayOrder - b.displayOrder);
          setScheduleItems(items);
        } else {
          // Initialize new schedule
          setStatus("draft");
          setShowPhysiotherapy(true);
          if (isWeekday) {
            // Include Physiotherapy & Rehabilitation by default on Monday-Saturday
            const fixedItem: ScheduleItem = {
              id: "fixed_physio",
              doctorId: null,
              departmentId: "dept_physiotherapy",
              startTime: "09:00",
              endTime: "17:00",
              displayOrder: 0,
              itemType: "fixed_service",
            };
            setScheduleItems([fixedItem]);
          } else {
            setScheduleItems([]);
          }
        }
      } catch (error) {
        console.error("Error fetching schedule:", error);
        setSubmitError("Failed to load schedule. Try seeding the database in Profile tab first.");
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [selectedDate]);

  // Handle Add Doctor
  const handleAddDoctor = (newItemPayload: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">) => {
    const newItem: ScheduleItem = {
      ...newItemPayload,
      id: `local_${Date.now()}`,
      displayOrder: scheduleItems.length,
    };
    
    // Put doctor items before the fixed service if it exists
    const fixedIndex = scheduleItems.findIndex((item) => item.itemType === "fixed_service");
    if (fixedIndex !== -1) {
      const updated = [...scheduleItems];
      updated.splice(fixedIndex, 0, newItem);
      // Re-index display orders
      updated.forEach((item, idx) => {
        item.displayOrder = idx;
      });
      setScheduleItems(updated);
    } else {
      setScheduleItems([...scheduleItems, newItem]);
    }
  };

  // Handle Edit Doctor
  const handleEditDoctor = (id: string, updatedItemPayload: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">) => {
    setScheduleItems(
      scheduleItems.map((item) =>
        item.id === id ? { ...item, ...updatedItemPayload } : item
      )
    );
    setEditingItem(null);
  };

  // Handle Delete Doctor
  const handleDeleteDoctor = (id: string) => {
    const updated = scheduleItems.filter((item) => item.id !== id);
    // Re-index display orders
    updated.forEach((item, idx) => {
      item.displayOrder = idx;
    });
    setScheduleItems(updated);
  };

  // Handle Reordering
  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...scheduleItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex >= 0 &&
      targetIndex < newItems.length &&
      newItems[index].itemType === "doctor" &&
      newItems[targetIndex].itemType === "doctor"
    ) {
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;

      // Update display orders
      newItems.forEach((item, idx) => {
        item.displayOrder = idx;
      });

      setScheduleItems(newItems);
    }
  };

  // Submit Flow
  const handleSubmitSchedule = async () => {
    if (!user) return;
    setSubmitting(true);
    setSubmitError(null);

    // Filter doctor items for validation
    const doctorItems = scheduleItems.filter((item) => item.itemType === "doctor");

    if (doctorItems.length === 0) {
      setSubmitError("Please add at least one doctor before submitting.");
      setSubmitting(false);
      return;
    }

    try {
      // Prepare payload (removing local IDs and temp joins)
      const payloadItems = scheduleItems.map((item, index) => ({
        doctorId: item.doctorId,
        departmentId: item.departmentId,
        startTime: item.startTime,
        endTime: item.endTime,
        displayOrder: index,
        itemType: item.itemType,
      }));

      await savePosterRequest(selectedDate, user.uid, "submitted", payloadItems, showPhysiotherapy, "manual");
      setStatus("submitted");
      setShowSuccess(true);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || "Failed to submit schedule. Please try again.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  // Join master data names for rendering
  // Join master data names for rendering
  const joinedItems = scheduleItems.map((item, index) => {
    if (item.itemType === "fixed_service") {
      const dept = departments.find((d) => d.id === item.departmentId);
      return {
        ...item,
        originalIdx: index,
        departmentNameEnglish: dept ? dept.nameEnglish : (item.departmentNameEnglish || "Physiotherapy & Rehabilitation"),
        departmentNameMalayalamUnicode: dept ? dept.nameMalayalamUnicode : (item.departmentNameMalayalamUnicode || "ഫിസിയോതെറാപ്പി & റീഹാബിലിറ്റേഷൻ"),
      };
    } else {
      const docObj = doctors.find((d) => d.id === item.doctorId);
      const dept = departments.find((d) => d.id === item.departmentId);
      return {
        ...item,
        originalIdx: index,
        doctorNameEnglish: docObj ? docObj.nameEnglish : (item.doctorNameEnglish || "Unknown Doctor"),
        doctorQualificationEnglish: docObj ? docObj.qualificationEnglish : (item.doctorQualificationEnglish || ""),
        doctorNameMalayalamUnicode: docObj ? docObj.nameMalayalamUnicode : (item.doctorNameMalayalamUnicode || ""),
        departmentNameEnglish: dept ? dept.nameEnglish : (item.departmentNameEnglish || "Unknown Department"),
        departmentNameMalayalamUnicode: dept ? dept.nameMalayalamUnicode : (item.departmentNameMalayalamUnicode || "Unknown Department"),
      };
    }
  });

  // Time overlap helper locally
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
    return true;
  }

  // Format 24-hour time to 12-hour AM/PM format
  function formatTime12(time24: string): string {
    if (!time24) return "";
    const [hourStr, minStr] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minStr} ${ampm}`;
  }

  // Helper to convert parsed items into ScheduleItems format
  const convertParsedToScheduleItems = (parsedItems: any[]): ScheduleItem[] => {
    return parsedItems.map((item, index) => {
      if (item.isUnknownDoctor || !item.doctor) {
        return {
          id: `parsed_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
          doctorId: null,
          departmentId: item.department ? item.department.id : (item.departmentId || "unknown_dept"),
          startTime: item.startTime || "09:00",
          endTime: item.endTime || "13:00",
          itemType: "doctor" as const,
          doctorNameMalayalamUnicode: item.doctorNameUnicode || "New Doctor",
          doctorQualificationEnglish: item.qualification || "",
          displayOrder: index
        };
      } else {
        return {
          id: `parsed_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
          doctorId: item.doctor.id,
          departmentId: item.department ? item.department.id : (item.departmentId || "unknown_dept"),
          startTime: item.startTime || "09:00",
          endTime: item.endTime || "13:00",
          itemType: "doctor" as const,
          displayOrder: index
        };
      }
    });
  };

  // Phase 4 Bulk Import Handlers
  const handleParseSchedule = async () => {
    if (!pastedText.trim()) {
      setSubmitError("Please paste some schedule text first.");
      return;
    }
    
    setSubmitError(null);
    try {
      const parsed = parseSchedule(pastedText, departments, doctors);
      // Determine date to use: detected date or manual selection fallback
      let dateToUse = parsed.date;
      if (!dateToUse) {
        dateToUse = selectedDate;
      }
      
      setLoading(true);
      const existingRequest = await fetchPosterRequestWithItems(dateToUse);
      setLoading(false);
      
      if (existingRequest) {
        setDuplicateCheck({
          showDialog: true,
          date: dateToUse,
          existingStatus: existingRequest.status,
          parsedItems: parsed.items,
        });
      } else {
        const parsedItemsToLoad = convertParsedToScheduleItems(parsed.items);
        
        // Auto-inject Physiotherapy service if weekday
        const day = getDayOfWeek(dateToUse);
        if (day !== 0) {
          parsedItemsToLoad.push({
            id: "fixed_physio",
            doctorId: null,
            departmentId: "dept_physiotherapy",
            startTime: "09:00",
            endTime: "17:00",
            displayOrder: parsedItemsToLoad.length,
            itemType: "fixed_service",
          });
        }
        
        setScheduleItems(parsedItemsToLoad);
        setSelectedDate(dateToUse);
        setPastedText("");
      }
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || "Failed to parse schedule. Please try again.");
    }
  };

  const handleMergeExisting = async () => {
    if (!duplicateCheck) return;
    setLoading(true);
    try {
      const existingRequest = await fetchPosterRequestWithItems(duplicateCheck.date);
      const existingItems = existingRequest?.scheduleItems || [];
      
      // Filter out physiotherapy fixed service to avoid duplication
      const filteredExisting = existingItems.filter(item => item.departmentId !== "dept_physiotherapy");
      
      const newParsedItems = convertParsedToScheduleItems(duplicateCheck.parsedItems);
      
      // Merge
      let merged = [...filteredExisting, ...newParsedItems];
      
      // Re-sort displayOrder
      merged = merged.map((item, index) => ({
        ...item,
        displayOrder: index
      }));
      
      // Append fixed service if weekday
      const day = getDayOfWeek(duplicateCheck.date);
      if (day !== 0 && !merged.some(item => item.itemType === "fixed_service")) {
        merged.push({
          id: "fixed_physio",
          doctorId: null,
          departmentId: "dept_physiotherapy",
          startTime: "09:00",
          endTime: "17:00",
          displayOrder: merged.length,
          itemType: "fixed_service",
        });
      }
      
      setScheduleItems(merged);
      setSelectedDate(duplicateCheck.date);
      setPastedText("");
      setDuplicateCheck(null);
    } catch (err) {
      console.error(err);
      setSubmitError("Failed to merge schedule items.");
    } finally {
      setLoading(false);
      setDuplicateCheck(null);
    }
  };

  // Prefill new doctor form and open quick add modal
  const handleRegisterNewDoctor = (globalIdx: number) => {
    const item = joinedItems[globalIdx];
    setMasterDocForm({
      nameEnglish: item.doctorNameMalayalamUnicode || item.doctorNameEnglish || "",
      nameMalayalamMVM: "",
      qualificationEnglish: item.doctorQualificationEnglish || "",
      departmentId: item.departmentId || "",
      reviewIndex: globalIdx
    });
    setAddMasterDocOpen(true);
  };

  // Submit master doctor form to Firestore and link it in the scheduleItems array
  const handleSaveMasterDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterDocForm.reviewIndex === null) return;
    
    setSubmitting(true);
    try {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await saveDoctor(docId, {
        departmentId: masterDocForm.departmentId,
        nameEnglish: masterDocForm.nameEnglish,
        nameMalayalamUnicode: masterDocForm.nameEnglish,
        nameMalayalamMVM: masterDocForm.nameMalayalamMVM,
        qualificationEnglish: masterDocForm.qualificationEnglish,
        qualificationMalayalamUnicode: masterDocForm.qualificationEnglish,
        qualificationMalayalamMVM: "",
        isActive: true,
        aliases: [masterDocForm.nameEnglish]
      });

      // Reload doctors list
      const docsData = await fetchActiveDoctors();
      setDoctors(docsData);

      // Match in scheduleItems directly
      const updated = [...scheduleItems];
      const idx = masterDocForm.reviewIndex;
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          doctorId: docId,
          doctorNameMalayalamUnicode: undefined,
          doctorQualificationEnglish: undefined,
        };
      }
      setScheduleItems(updated);
      setAddMasterDocOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Failed to save doctor to database: " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Page Title & Status */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Availability Planner</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage daily poster schedules</p>
          </div>
          
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              status === "submitted"
                ? "bg-teal-500/10 text-teal-600 border border-teal-500/20"
                : "bg-teal-50 text-teal-600 border border-teal-100/30"
            }`}
          >
            {status}
          </span>
        </div>

      </div>

      {/* Error Message */}
      {submitError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 flex items-start gap-2 animate-shake">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {/* RENDER MODES */}
      {isReviewing ? (
        /* 1. REVIEW SCREEN */
        <div className="flex flex-col gap-4">
          <div className="bg-teal-50/40 border border-teal-100/55 p-4 rounded-2xl flex flex-col gap-1.5 shadow-xs">
            <span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest">Reviewing Parsed Text</span>
            <h3 className="text-sm font-bold text-slate-800">Please review schedule matching</h3>
            <p className="text-[10px] text-slate-500">
              Target Date: <strong className="text-slate-700">{new Date(reviewDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {reviewItems.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      item.isUnrecognized
                        ? "bg-red-150 text-red-700 border border-red-200"
                        : item.isUnknownDoctor
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-emerald-100/80 text-emerald-800"
                    }`}>
                      {item.isUnrecognized
                        ? "Unrecognized Line"
                        : item.isUnknownDoctor
                        ? "New / Not in Doctor Database"
                        : "Matched Doctor"}
                    </span>
                    {item.notes && !item.isUnrecognized && (
                      <span className="text-[10px] text-amber-600 font-semibold italic">{item.notes}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewItems(reviewItems.filter((_, i) => i !== idx))}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>

                {item.isUnrecognized ? (
                  <div className="flex flex-col gap-2 p-3 bg-red-50/40 border border-red-100/40 rounded-2xl">
                    <span className="text-[10px] text-red-800 font-semibold leading-relaxed">
                      This line was not recognized. You can either mark it as a new doctor, select an existing doctor, or remove this entry.
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...reviewItems];
                          updated[idx].isUnrecognized = false;
                          updated[idx].isUnknownDoctor = true;
                          updated[idx].doctorNameUnicode = item.originalText.trim();
                          updated[idx].status = "Needs Review";
                          setReviewItems(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-[10px] hover:bg-teal-700 transition-colors cursor-pointer"
                      >
                        Mark as New Doctor
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...reviewItems];
                          updated[idx].isUnrecognized = false;
                          updated[idx].isUnknownDoctor = false;
                          updated[idx].status = "Needs Review";
                          setReviewItems(updated);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[10px] hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Select Existing Doctor
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Department Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
                        <select
                          value={item.department?.id || ""}
                          onChange={(e) => {
                            const deptId = e.target.value;
                            const deptObj = departments.find(d => d.id === deptId) || null;
                            const updated = [...reviewItems];
                            updated[idx] = {
                              ...updated[idx],
                              department: deptObj,
                              doctor: updated[idx].doctor?.departmentId === deptId ? updated[idx].doctor : null,
                              qualification: updated[idx].doctor?.departmentId === deptId ? updated[idx].qualification : "",
                              status: deptObj && (updated[idx].doctor?.departmentId === deptId || updated[idx].isUnknownDoctor) ? "Matched" : "Needs Review",
                            };
                            setReviewItems(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white h-10 cursor-pointer"
                        >
                          <option value="">Select Department</option>
                          {departments.filter(d => d.id !== "dept_physiotherapy").map(d => (
                            <option key={d.id} value={d.id}>{d.nameEnglish}</option>
                          ))}
                        </select>
                      </div>

                      {/* Doctor Selection / Input */}
                      <div className="flex flex-col gap-1.5">
                        {item.isUnknownDoctor ? (
                          <>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Doctor Name (New Doctor)</label>
                            <input
                              type="text"
                              value={item.doctorNameUnicode || ""}
                              onChange={(e) => {
                                const updated = [...reviewItems];
                                updated[idx].doctorNameUnicode = e.target.value;
                                setReviewItems(updated);
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white h-10"
                              placeholder="e.g. ഡോ. പുതിയ ഡോക്ടർ"
                            />
                            <div className="mt-0.5 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...reviewItems];
                                  updated[idx].isUnknownDoctor = false;
                                  updated[idx].doctor = null;
                                  updated[idx].doctorNameUnicode = "";
                                  updated[idx].status = "Needs Review";
                                  setReviewItems(updated);
                                }}
                                className="text-[9px] text-teal-600 hover:text-teal-700 font-bold cursor-pointer"
                              >
                                Select Existing Doctor instead
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleRegisterNewDoctor(idx)}
                                className="text-[9px] text-emerald-655 hover:text-emerald-800 font-bold cursor-pointer flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100"
                              >
                                <Plus className="h-3 w-3 text-emerald-600" />
                                <span>Add to Doctor Database</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Doctor</label>
                            <select
                              value={item.doctor?.id || ""}
                              onChange={(e) => {
                                const docId = e.target.value;
                                const docObj = doctors.find(d => d.id === docId) || null;
                                const updated = [...reviewItems];
                                updated[idx] = {
                                  ...updated[idx],
                                  doctor: docObj,
                                  doctorNameUnicode: docObj ? docObj.nameMalayalamUnicode : "",
                                  qualification: docObj ? docObj.qualificationEnglish : "",
                                  status: item.department && docObj ? "Matched" : "Needs Review",
                                };
                                setReviewItems(updated);
                              }}
                              disabled={!item.department}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white h-10 disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                            >
                              <option value="">Select Doctor</option>
                              {doctors.filter(d => d.departmentId === item.department?.id).map(d => (
                                <option key={d.id} value={d.id}>{d.nameEnglish}</option>
                              ))}
                            </select>
                            {/* Removed Mark as New toggle */}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Start Time</label>
                        <input
                          type="time"
                          value={item.startTime}
                          onChange={(e) => {
                            const updated = [...reviewItems];
                            const newStart = e.target.value;
                            updated[idx].startTime = newStart;
                            
                            // Dynamically manage "Missing time schedule" warning
                            const currentNotes = updated[idx].notes || "";
                            const notesList = currentNotes ? currentNotes.split(";").map((p: string) => p.trim()) : [];
                            const hasTime = Boolean(newStart && updated[idx].endTime);

                            if (hasTime) {
                              updated[idx].notes = notesList.filter((p: string) => p !== "Missing time schedule").join("; ");
                            } else {
                              if (!notesList.includes("Missing time schedule")) {
                                notesList.push("Missing time schedule");
                              }
                              updated[idx].notes = notesList.filter((p: string) => p).join("; ");
                            }

                            setReviewItems(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 h-10 bg-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">End Time</label>
                        <input
                          type="time"
                          value={item.endTime}
                          onChange={(e) => {
                            const updated = [...reviewItems];
                            const newEnd = e.target.value;
                            updated[idx].endTime = newEnd;

                            // Dynamically manage "Missing time schedule" warning
                            const currentNotes = updated[idx].notes || "";
                            const notesList = currentNotes ? currentNotes.split(";").map((p: string) => p.trim()) : [];
                            const hasTime = Boolean(updated[idx].startTime && newEnd);

                            if (hasTime) {
                              updated[idx].notes = notesList.filter((p: string) => p !== "Missing time schedule").join("; ");
                            } else {
                              if (!notesList.includes("Missing time schedule")) {
                                notesList.push("Missing time schedule");
                              }
                              updated[idx].notes = notesList.filter((p: string) => p).join("; ");
                            }

                            setReviewItems(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 h-10 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {item.isUnknownDoctor ? "Qualification (Editable)" : "Qualification (Auto-filled)"}
                      </label>
                      <input
                        type="text"
                        readOnly={!item.isUnknownDoctor}
                        value={item.qualification || ""}
                        onChange={(e) => {
                          if (item.isUnknownDoctor) {
                            const updated = [...reviewItems];
                            updated[idx].qualification = e.target.value;
                            setReviewItems(updated);
                          }
                        }}
                        placeholder={item.isUnknownDoctor ? "e.g. MBBS, MD" : "Qualification from master data"}
                        className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold h-10 focus:outline-none ${
                          item.isUnknownDoctor
                            ? "bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-slate-800"
                            : "bg-teal-50/10 text-teal-700/70"
                        }`}
                      />
                    </div>
                  </>
                )}

                <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-500 font-medium border border-slate-100">
                  <span className="font-bold text-slate-700">Original text:</span>
                  <pre className="whitespace-pre-wrap mt-1 font-sans leading-relaxed text-slate-600">{item.originalText}</pre>
                </div>
              </div>
            ))}

          </div>

          {/* Action Row */}
          <div className="flex flex-col gap-3 mt-2 shrink-0">
            <button
              type="button"
              onClick={handleAddReviewItem}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-1 cursor-pointer h-12 shadow-xs"
            >
              <Plus className="h-5 w-5 text-teal-600" />
              <span>Add Doctor Item</span>
            </button>
            
            {submitError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 flex items-start gap-2 animate-shake mb-4">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsReviewing(false);
                  setSubmitError(null);
                }}
                className="flex-1 bg-white hover:bg-red-50 border border-slate-200 text-red-600 font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-1 cursor-pointer h-12"
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmReview}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 cursor-pointer h-12 shadow-xs"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>Confirm & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. UNIFIED CREATION MODE */
        <div className="flex flex-col gap-4">
          {/* Date Selector Banner */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Schedule Date
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {new Date(selectedDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-slate-700 bg-teal-50/20 h-10 shrink-0 cursor-pointer"
            />
          </div>

          {/* Physiotherapy Toggle Card */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Poster Options
                </span>
                <span className="text-sm font-bold text-slate-800">
                  Physiotherapy & Rehabilitation
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPhysiotherapy}
                onChange={(e) => setShowPhysiotherapy(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {/* WhatsApp Paste Import Section */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-slate-800">Import WhatsApp Schedule</h3>
              <p className="text-xs text-slate-505">
                Paste the WhatsApp Malayalam schedule text below to parse and map availability details.
              </p>
            </div>
            
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="23/08/2026 ഞായർ&#10;&#10;ജനറൽ ഒ.പി&#10;ഡോ. മേബിൾ ജോൺ&#10;MBBS&#10;രാവിലെ 8 മണി രാത്രി 8 വരെ..."
              rows={5}
              className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-slate-700 bg-slate-50/10 resize-y min-h-[120px]"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setPastedText(text);
                  } catch (err) {
                    alert("Clipboard permission not granted. Please paste text manually using keyboard shortcuts.");
                  }
                }}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl py-3 transition-all flex items-center justify-center gap-1.5 cursor-pointer h-11 h-11 shadow-xs"
              >
                <span>Paste Text</span>
              </button>
              
              <button
                type="button"
                onClick={handleParseSchedule}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl py-3 transition-all flex items-center justify-center gap-1.5 cursor-pointer h-11 shadow-xs"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Parse Schedule</span>
                )}
              </button>
            </div>
          </div>

          {/* Schedule Items List */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Doctors Availability List
            </h3>

            {loading ? (
              <div className="bg-white border border-slate-100 rounded-2xl py-12 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400 font-semibold mt-1">Loading schedule details...</span>
              </div>
            ) : joinedItems.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="p-3.5 rounded-full bg-teal-50/30 text-teal-600">
                  <Activity className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-bold text-slate-800 text-sm">Schedule is Empty</h4>
                  <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                    Add doctors to set their shift availability for this date.
                  </p>
                </div>
              </div>
            ) : (() => {
              // Group adjacent items by department for the layout
              const groupedDeps: {
                departmentId: string;
                departmentNameMalayalamUnicode: string;
                departmentNameEnglish: string;
                isFixed: boolean;
                items: any[];
              }[] = [];

              joinedItems.forEach((item) => {
                const isFixed = item.itemType === "fixed_service";
                const lastGroup = groupedDeps[groupedDeps.length - 1];
                
                if (lastGroup && lastGroup.departmentId === item.departmentId && lastGroup.isFixed === isFixed) {
                  lastGroup.items.push(item);
                } else {
                  groupedDeps.push({
                    departmentId: item.departmentId,
                    departmentNameMalayalamUnicode: item.departmentNameMalayalamUnicode || item.departmentNameEnglish || "Unknown Department",
                    departmentNameEnglish: item.departmentNameEnglish || "Unknown Department",
                    isFixed,
                    items: [item],
                  });
                }
              });

              return (
                <div className="flex flex-col gap-4">
                  {groupedDeps.map((group, groupIdx) => {
                    if (group.isFixed) {
                      const item = group.items[0];
                      return (
                        <div key={group.departmentId} className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4 flex justify-between items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 uppercase tracking-wider">
                                Fixed Service
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm">
                              {group.departmentNameMalayalamUnicode}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">Daily Outpatient Service</p>
                            <div className="text-xs font-semibold text-teal-700 mt-0.5">
                              {formatTime12(item.startTime)} - {formatTime12(item.endTime)}
                            </div>
                          </div>
                          <div className="flex items-center justify-center p-2 text-teal-600 bg-teal-100/50 rounded-xl shrink-0">
                            <Activity className="h-5 w-5" />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={groupIdx} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs animate-fadeIn">
                        {/* Department Heading */}
                        <div className="border-b border-slate-100/50 pb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {group.departmentNameMalayalamUnicode}
                          </span>
                        </div>

                        {/* Doctors List */}
                        <div className="flex flex-col gap-4">
                          {group.items.map((item, idxInGroup) => {
                            const globalIdx = item.originalIdx;
                            const hasPrevDoctor = globalIdx > 0 && joinedItems[globalIdx - 1].itemType === "doctor";
                            const hasNextDoctor = globalIdx < joinedItems.length - 1 && joinedItems[globalIdx + 1].itemType === "doctor";

                            return (
                              <div
                                key={item.id}
                                className={`flex justify-between items-center gap-3 ${
                                  idxInGroup > 0 ? "border-t border-slate-100/50 pt-4" : ""
                                }`}
                              >
                                <div className="flex-1 flex flex-col gap-1">
                                  <h4 className="font-bold text-slate-900 text-sm">
                                    {item.doctorNameMalayalamUnicode || item.doctorNameEnglish}
                                  </h4>
                                  <p className="text-xs text-slate-500 font-medium">
                                    {item.doctorQualificationEnglish}
                                  </p>
                                  <div className="text-xs font-bold text-teal-600 mt-1">
                                    {formatTime12(item.startTime)} - {formatTime12(item.endTime)}
                                  </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Reordering Controls */}
                                  <div className="flex flex-col gap-1 border-r border-slate-100 pr-2 mr-1">
                                    <button
                                      type="button"
                                      disabled={!hasPrevDoctor}
                                      onClick={hasPrevDoctor ? () => moveItem(globalIdx, "up") : undefined}
                                      className="p-1.5 rounded-lg border border-slate-100 text-slate-400 hover:bg-teal-50/30 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!hasNextDoctor}
                                      onClick={hasNextDoctor ? () => moveItem(globalIdx, "down") : undefined}
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
                                      onClick={() => {
                                        setEditingItem(item);
                                        setIsAddModalOpen(true);
                                      }}
                                      className="p-2.5 rounded-xl border border-slate-100 text-slate-600 hover:bg-teal-50/30 transition-colors cursor-pointer"
                                      title="Edit Doctor"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDoctor(item.id)}
                                      className="p-2.5 rounded-xl border border-red-50 text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Delete Doctor"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Action Footer Bar */}
          {!loading && (
            <div className="flex gap-3 mt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(true);
                }}
                className="flex-1 bg-white hover:bg-teal-50/30 border border-slate-200/60 text-slate-700 font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 cursor-pointer h-12 shadow-xs"
              >
                <Plus className="h-5 w-5 text-teal-600" />
                <span>Add Doctor</span>
              </button>
              
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitSchedule}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 cursor-pointer h-12 shadow-xs"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>Submit to Designer</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Doctor Modal */}
      <AddDoctorModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onAdd={handleAddDoctor}
        onEdit={handleEditDoctor}
        editingItem={editingItem}
        departments={departments}
        doctors={doctors}
        existingItems={scheduleItems}
      />

      {/* Quick Add Master Doctor Modal */}
      {isAddMasterDocOpen && (
        <div className="fixed inset-0 z-55 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-100 shadow-2xl flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Add New Doctor to Database</h3>
              <button
                type="button"
                onClick={() => setAddMasterDocOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-teal-50/30 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveMasterDoc} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Department */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Department
                </label>
                <select
                  value={masterDocForm.departmentId}
                  onChange={(e) => setMasterDocForm({ ...masterDocForm, departmentId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  required
                >
                  <option value="">Select Department</option>
                  {departments
                    .filter((d) => d.id !== "dept_physiotherapy")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nameEnglish}
                      </option>
                    ))}
                </select>
              </div>

              {/* Doctor Name (Unicode Malayalam) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Doctor Name (Malayalam)
                </label>
                <input
                  type="text"
                  value={masterDocForm.nameEnglish}
                  onChange={(e) => setMasterDocForm({ ...masterDocForm, nameEnglish: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  placeholder="e.g. ഡോ. കൃഷ്ണദാസ്"
                  required
                />
              </div>

              {/* Doctor Name MVM Font (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Doctor Name (MVM Font - Optional)
                </label>
                <input
                  type="text"
                  value={masterDocForm.nameMalayalamMVM}
                  onChange={(e) => setMasterDocForm({ ...masterDocForm, nameMalayalamMVM: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  placeholder="e.g. tUm. IrjvWZmkv"
                />
              </div>

              {/* Qualification */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Qualification
                </label>
                <input
                  type="text"
                  value={masterDocForm.qualificationEnglish}
                  onChange={(e) => setMasterDocForm({ ...masterDocForm, qualificationEnglish: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  placeholder="e.g. MBBS, MD"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4 shrink-0 pb-2">
                <button
                  type="button"
                  onClick={() => setAddMasterDocOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl py-3 transition-colors cursor-pointer h-11 flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-sm rounded-xl py-3 transition-all cursor-pointer h-11 flex items-center justify-center gap-1.5 font-bold"
                >
                  {submitting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Save to Database</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submission Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center gap-4 shadow-2xl animate-scaleUp">
            <div className="h-12 w-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-slate-900 text-base">Schedule Saved!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Availability list for {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} has been saved successfully.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer text-center font-bold"
            >
              Back to Planner
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Handling Dialog */}
      {duplicateCheck && duplicateCheck.showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center gap-4 shadow-2xl animate-scaleUp">
            <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-slate-900 text-base">Schedule Already Exists</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                A schedule request for {new Date(duplicateCheck.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} already exists.
              </p>
              <div className="text-[10px] bg-slate-50 text-slate-600 p-2 rounded-xl mt-1 font-semibold flex justify-center items-center gap-1.5 border border-slate-100">
                <span>Current status:</span>
                <span className="font-bold uppercase text-[9px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">{duplicateCheck.existingStatus}</span>
              </div>
            </div>
            
            <div className="w-full flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(duplicateCheck.date);
                  setDuplicateCheck(null);
                }}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
              >
                Review Existing Schedule
              </button>

              {(duplicateCheck.existingStatus === "draft" || duplicateCheck.existingStatus === "submitted") ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const parsedItemsToLoad = convertParsedToScheduleItems(duplicateCheck.parsedItems);
                      const day = getDayOfWeek(duplicateCheck.date);
                      if (day !== 0) {
                        parsedItemsToLoad.push({
                          id: "fixed_physio",
                          doctorId: null,
                          departmentId: "dept_physiotherapy",
                          startTime: "09:00",
                          endTime: "17:00",
                          displayOrder: parsedItemsToLoad.length,
                          itemType: "fixed_service",
                        });
                      }
                      setScheduleItems(parsedItemsToLoad);
                      setSelectedDate(duplicateCheck.date);
                      setPastedText("");
                      setDuplicateCheck(null);
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
                  >
                    Replace Existing Draft
                  </button>

                  <button
                    type="button"
                    onClick={handleMergeExisting}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
                  >
                    Merge with Existing Draft
                  </button>
                </>
              ) : (
                <div className="p-3 bg-red-50 border border-red-100 text-[10px] text-red-700 font-semibold rounded-xl text-left leading-relaxed">
                  This schedule is currently being processed or completed and cannot be modified.
                </div>
              )}

              <button
                type="button"
                onClick={() => setDuplicateCheck(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white">
        <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold mt-2">Loading calendar view...</span>
      </div>
    }>
      <ScheduleContent />
    </Suspense>
  );
}
