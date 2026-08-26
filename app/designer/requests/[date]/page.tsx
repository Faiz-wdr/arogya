"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  Department,
  Doctor,
  ScheduleItem,
  PosterRequest,
  fetchActiveDepartments,
  fetchActiveDoctors,
  fetchPosterRequestWithItems,
  savePosterRequest,
  updatePosterRequestStatus,
  saveGeneratedPosterMetadata,
  fetchPosterSettings,
  savePosterSettings
} from "@/lib/services/db";
import { getEnglishDateString, getMalayalamDateString, getMalayalamMVMDateString } from "@/lib/utils/dateUtils";
import AddDoctorModal from "@/components/AddDoctorModal";
import {
  Calendar,
  User,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Lock,
  Copy,
  Check,
  Building,
  Activity,
  Layers,
  ArrowRight,
  Eye,
  Download,
  RefreshCw,
  X,
  AlertTriangle,
  Image as ImageIcon
} from "lucide-react";

// Helper to format time (e.g. "09:00" -> "9:00 AM")
function formatTime12(time24: string): string {
  if (!time24) return "";
  const [hourStr, minStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minStr} ${ampm}`;
}

function RequestDetailsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { date } = useParams();
  const dateString = date as string;

  // Master Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Page States
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [status, setStatus] = useState<"draft" | "submitted" | "processing" | "completed">("submitted");
  const [createdBy, setCreatedBy] = useState("");
  const [createdByName, setCreatedByName] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPhysiotherapy, setShowPhysiotherapy] = useState<boolean>(true);

  // Poster Generation States
  const [generating, setGenerating] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState<PosterRequest["generatedPoster"]>(undefined);
  const [posterVersions, setPosterVersions] = useState<NonNullable<PosterRequest["posterVersions"]>>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [validationErrors, setValidationErrors] = useState<{ type: string; id: string; name: string; field: string; path: string }[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Copy Feedback State
  const [copiedFields, setCopiedFields] = useState<{ [key: string]: boolean }>({});

  // Date Positioning States
  const [datePositionX, setDatePositionX] = useState<number>(80);
  const [datePositionY, setDatePositionY] = useState<number>(80);
  const [isSavingPosition, setIsSavingPosition] = useState<boolean>(false);
  const [positionSavedFeedback, setPositionSavedFeedback] = useState<boolean>(false);

  // Auto-Regenerate on Download states
  const [isPosterOutdated, setIsPosterOutdated] = useState(false);
  const [isDownloadingPNG, setIsDownloadingPNG] = useState(false);

  // Workflow Confirmation Modals
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);

  // Edit Schedule Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Load request details and master data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const deptsData = await fetchActiveDepartments();
      const docsData = await fetchActiveDoctors();
      setDepartments(deptsData);
      setDoctors(docsData);

      // Load date position settings
      try {
        const settings = await fetchPosterSettings();
        setDatePositionX(settings.datePositionX);
        setDatePositionY(settings.datePositionY);
      } catch (settingsErr) {
        console.error("Failed to load poster settings", settingsErr);
      }

      const request = await fetchPosterRequestWithItems(dateString);
      if (request) {
        setScheduleItems(request.scheduleItems || []);
        setStatus(request.status);
        setCreatedBy(request.createdBy);
        setCreatedByName(request.createdByName || "Hospital Staff");
        setGeneratedPoster(request.generatedPoster);
        setPosterVersions(request.posterVersions || []);
        const dateObj = new Date(dateString);
        const isWeekday = dateObj.getDay() !== 0; // 0 is Sunday
        setShowPhysiotherapy(request.showPhysiotherapy !== undefined ? request.showPhysiotherapy : isWeekday);

        // Check if generated poster is outdated relative to database schedule edits
        const genTime = request.generatedPoster?.generatedAt?.toDate?.()?.getTime() || 0;
        const updTime = request.updatedAt?.toDate?.()?.getTime() || 0;
        const isOutdated = !request.generatedPoster || (updTime > 0 && genTime < updTime - 2000);
        setIsPosterOutdated(isOutdated);
      } else {
        setError("Poster Request not found in the database.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load poster request details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateString) {
      loadData();
    }
  }, [dateString]);

  // Join master data names and MVM properties
  const joinedItems = scheduleItems.map((item) => {
    if (item.itemType === "fixed_service") {
      const dept = departments.find((d) => d.id === item.departmentId);
      return {
        ...item,
        departmentNameEnglish: dept ? dept.nameEnglish : (item.departmentNameEnglish || "Physiotherapy & Rehabilitation"),
        departmentNameMalayalamUnicode: dept ? dept.nameMalayalamUnicode : (item.departmentNameMalayalamUnicode || "ഫിസിയോതെറാപ്പി & റീഹാബിലിറ്റേഷൻ"),
        departmentNameMalayalamMVM: dept ? dept.nameMalayalamMVM : (item.departmentNameMalayalamMVM || "^nknbmt¯d¸n & dolm_nentej³"),
      };
    } else {
      const docObj = doctors.find((d) => d.id === item.doctorId);
      const dept = departments.find((d) => d.id === item.departmentId);
      return {
        ...item,
        doctorNameEnglish: docObj ? docObj.nameEnglish : (item.doctorNameEnglish || "Unknown Doctor"),
        doctorNameMalayalamUnicode: docObj ? docObj.nameMalayalamUnicode : (item.doctorNameMalayalamUnicode || ""),
        doctorNameMalayalamMVM: docObj ? docObj.nameMalayalamMVM : (item.doctorNameMalayalamMVM || ""),
        doctorQualificationEnglish: docObj ? docObj.qualificationEnglish : (item.doctorQualificationEnglish || ""),
        doctorQualificationMalayalamUnicode: docObj ? docObj.qualificationMalayalamUnicode : (item.doctorQualificationMalayalamUnicode || ""),
        doctorQualificationMalayalamMVM: docObj ? docObj.qualificationMalayalamMVM : (item.doctorQualificationMalayalamMVM || ""),
        departmentNameEnglish: dept ? dept.nameEnglish : (item.departmentNameEnglish || "Unknown Department"),
        departmentNameMalayalamUnicode: dept ? dept.nameMalayalamUnicode : (item.departmentNameMalayalamUnicode || ""),
        departmentNameMalayalamMVM: dept ? dept.nameMalayalamMVM : (item.departmentNameMalayalamMVM || ""),
      };
    }
  });

  // Check if any MVM data is missing in the current schedule list
  const hasMissingMVM = joinedItems.some((item) => {
    if (item.itemType === "fixed_service") {
      return !item.departmentNameMalayalamMVM;
    } else {
      return (
        !item.departmentNameMalayalamMVM ||
        !item.doctorNameMalayalamMVM
      );
    }
  });

  // Handle Add Doctor (Designer Schedule Override)
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
      updated.forEach((item, idx) => { item.displayOrder = idx; });
      setScheduleItems(updated);
    } else {
      setScheduleItems([...scheduleItems, newItem]);
    }
    setIsPosterOutdated(true);
  };

  // Handle Edit Doctor (Designer Override)
  const handleEditDoctor = (id: string, updatedItemPayload: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">) => {
    setScheduleItems(
      scheduleItems.map((item) =>
        item.id === id ? { ...item, ...updatedItemPayload } : item
      )
    );
    setEditingItem(null);
    setIsPosterOutdated(true);
  };

  // Handle Delete Doctor
  const handleDeleteDoctor = (id: string) => {
    const updated = scheduleItems.filter((item) => item.id !== id);
    updated.forEach((item, idx) => { item.displayOrder = idx; });
    setScheduleItems(updated);
    setIsPosterOutdated(true);
  };

  // Handle Clear All Items
  const handleClearAllItems = () => {
    if (window.confirm("Are you sure you want to clear all items in the schedule? This will empty the list.")) {
      setScheduleItems([]);
      setIsPosterOutdated(true);
    }
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
      newItems.forEach((item, idx) => { item.displayOrder = idx; });
      setScheduleItems(newItems);
      setIsPosterOutdated(true);
    }
  };

  // Copy Clipboard action wrapper
  const copyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFields({ ...copiedFields, [fieldKey]: true });
    setTimeout(() => {
      setCopiedFields((prev) => ({ ...prev, [fieldKey]: false }));
    }, 1500);
  };

  // Copy Single Doctor Block in logical lines
  const copyDoctorBlock = (item: any, mode: "unicode" | "mvm", key: string) => {
    const isFixed = item.itemType === "fixed_service";
    let blockText = "";
    
    if (mode === "unicode") {
      blockText = isFixed
        ? `${item.departmentNameMalayalamUnicode}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`
        : `${item.departmentNameMalayalamUnicode}\n${item.doctorNameMalayalamUnicode}\n${item.doctorQualificationMalayalamUnicode}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;
    } else {
      blockText = isFixed
        ? `${item.departmentNameMalayalamMVM || "[MVM Dept Missing]"}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`
        : `${item.departmentNameMalayalamMVM || "[MVM Dept Missing]"}\n${item.doctorNameMalayalamMVM || "[MVM Name Missing]"}\n${item.doctorQualificationEnglish || ""}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;
    }
    
    copyToClipboard(blockText, key);
  };

  // Copy All Poster Content (All Doctors in displayOrder sequence)
  const copyAllPosterContent = (mode: "unicode" | "mvm", key: string) => {
    const blocks = joinedItems.map((item) => {
      const isFixed = item.itemType === "fixed_service";
      if (mode === "unicode") {
        return isFixed
          ? `${item.departmentNameMalayalamUnicode}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`
          : `${item.departmentNameMalayalamUnicode}\n${item.doctorNameMalayalamUnicode}\n${item.doctorQualificationMalayalamUnicode}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;
      } else {
        return isFixed
          ? `${item.departmentNameMalayalamMVM || "MVM content missing"}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`
          : `${item.departmentNameMalayalamMVM || "MVM content missing"}\n${item.doctorNameMalayalamMVM || "MVM content missing"}\n${item.doctorQualificationEnglish || ""}\n${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;
      }
    });

    copyToClipboard(blocks.join("\n\n"), key);
  };

  // Update request status helper
  const handleUpdateStatus = async (newStatus: "draft" | "submitted" | "processing" | "completed") => {
    setSaving(true);
    setError(null);
    try {
      await updatePosterRequestStatus(dateString, newStatus);
      setStatus(newStatus);
      setShowReopenConfirm(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to update status in database.");
    } finally {
      setSaving(false);
    }
  };

  // Save changes to schedule overrides
  const handleSaveScheduleOverrides = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      const payloadItems = scheduleItems.map((item, index) => ({
        doctorId: item.doctorId,
        departmentId: item.departmentId,
        startTime: item.startTime,
        endTime: item.endTime,
        displayOrder: index,
        itemType: item.itemType,
      }));

      await savePosterRequest(dateString, createdBy || user.uid, status, payloadItems, showPhysiotherapy);
      setShowSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save schedule changes.");
    } finally {
      setSaving(false);
    }
  };

  // Generate poster PNG via server-side Puppeteer and upload to Storage
  const handleGeneratePoster = async () => {
    // 1. Run validation checks
    const errors: typeof validationErrors = [];
    const seenDepts = new Set<string>();
    const seenDocs = new Set<string>();

    joinedItems.forEach((item) => {
      if (item.itemType === "fixed_service") {
        if (!item.departmentNameMalayalamMVM && !seenDepts.has(item.departmentId)) {
          seenDepts.add(item.departmentId);
          errors.push({
            type: "department",
            id: item.departmentId,
            name: item.departmentNameEnglish || "Fixed Service Department",
            field: "Department MVM Value",
            path: "/designer/departments",
          });
        }
      } else {
        if (!item.departmentNameMalayalamMVM && item.departmentId && !seenDepts.has(item.departmentId)) {
          seenDepts.add(item.departmentId);
          errors.push({
            type: "department",
            id: item.departmentId,
            name: item.departmentNameEnglish || "Department",
            field: "Department MVM Value",
            path: "/designer/departments",
          });
        }
        if (item.doctorId && !seenDocs.has(item.doctorId)) {
          if (!item.doctorNameMalayalamMVM) {
            seenDocs.add(item.doctorId);
            errors.push({
              type: "doctor",
              id: item.doctorId,
              name: item.doctorNameEnglish || "Doctor",
              field: "Name MVM",
              path: "/designer/doctors",
            });
          }
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    if (!user) return;
    setGenerating(true);
    setError(null);

    try {
      // 2. Call backend server-side Puppeteer rendering
      const response = await fetch("/api/designer/poster/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateString,
          showPhysiotherapy,
          datePositionX,
          datePositionY,
          items: joinedItems.map((i) => ({
            id: i.id,
            doctorId: i.doctorId,
            departmentId: i.departmentId,
            startTime: i.startTime,
            endTime: i.endTime,
            displayOrder: i.displayOrder,
            itemType: i.itemType,
            departmentNameMalayalamMVM: i.departmentNameMalayalamMVM,
            doctorNameMalayalamMVM: i.doctorNameMalayalamMVM,
            doctorQualificationEnglish: i.doctorQualificationEnglish,
          })),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to render poster image");
      }

      const imageBlob = await response.blob();

      // 3. Upload raw PNG image directly to Firebase Storage
      const currentVer = generatedPoster?.version || 0;
      const nextVer = currentVer + 1;
      const year = dateString.substring(0, 4);
      const month = dateString.substring(5, 7);
      const storagePath = `posters/${year}/${month}/arogya-doctors-${dateString}-v${nextVer}.png`;

      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");

      const posterRef = ref(storage, storagePath);
      await uploadBytes(posterRef, imageBlob, { contentType: "image/png" });
      const downloadUrl = await getDownloadURL(posterRef);

      // 4. Save metadata back to Firestore
      await saveGeneratedPosterMetadata(dateString, storagePath, downloadUrl, nextVer, user.uid);
      
      // Auto-update request status from 'submitted' to 'processing'
      if (status === "submitted") {
        await updatePosterRequestStatus(dateString, "processing");
        setStatus("processing");
      }

      // Reload
      await loadData();
      setPreviewZoom(1);
      return { downloadUrl, imageBlob };
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate poster: ${err.message || err}`);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePosition = async () => {
    setIsSavingPosition(true);
    try {
      await savePosterSettings({ datePositionX, datePositionY });
      setPositionSavedFeedback(true);
      setTimeout(() => setPositionSavedFeedback(false), 2050);
    } catch (err: any) {
      console.error(err);
      alert("Failed to save poster position settings: " + (err.message || err));
    } finally {
      setIsSavingPosition(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!generatedPoster) return;
    
    const filename = `arogya-doctors-${dateString}.png`;
    
    if (isPosterOutdated) {
      setIsDownloadingPNG(true);
      try {
        await handleSavePosition();
        
        const payloadItems = scheduleItems.map((item, index) => ({
          doctorId: item.doctorId,
          departmentId: item.departmentId,
          startTime: item.startTime,
          endTime: item.endTime,
          displayOrder: index,
          itemType: item.itemType,
        }));
        await savePosterRequest(dateString, createdBy || user?.uid || "", status, payloadItems, showPhysiotherapy);

        const result = await handleGeneratePoster();
        if (result && result.imageBlob) {
          setIsPosterOutdated(false);
          const blobUrl = URL.createObjectURL(result.imageBlob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }
      } catch (err) {
        console.error("Auto-regeneration download failed:", err);
        alert("Failed to auto-regenerate and download poster: " + err);
      } finally {
        setIsDownloadingPNG(false);
      }
    } else {
      // Instant download of the pre-existing poster
      try {
        const res = await fetch(generatedPoster.downloadUrl);
        if (!res.ok) throw new Error("Fetch failed");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.error("CORS block or fetch error, falling back to new tab:", e);
        window.open(generatedPoster.downloadUrl, "_blank");
      }
    }
  };

  // Get date in MVM format for preview overlay
  const mvmDate = getMalayalamMVMDateString(dateString);
  let calDayMonth = "";
  let calYearWeekday = "";
  if (mvmDate) {
    const parts = mvmDate.split(" ");
    if (parts.length >= 4) {
      calDayMonth = `${parts[0]} ${parts[1]}`;
      calYearWeekday = `${parts[2]} ${parts[3]}`;
    } else {
      calDayMonth = mvmDate;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back Link */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/designer/requests")}
            className="p-2 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <span className="text-xs font-semibold text-slate-400">Back to requests log</span>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-24 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold mt-1">Loading workspace...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-650 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Missing MVM Alert Banner */}
          {hasMissingMVM && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800 flex items-start gap-2.5">
              <AlertTriangleIcon className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">Some MVM content is missing!</span>
                <span className="font-normal text-amber-700">
                  Complete the missing MVM fields in Doctor or Department settings before printing the poster.
                </span>
              </div>
            </div>
          )}


          {/* Date Header Title */}
          <div className="flex flex-col gap-1.5 px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Poster Content Workspace
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              {getEnglishDateString(dateString)}
            </h2>
          </div>

          {/* Two Column Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Doctor List and Copy Area (Col span 8) */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              
              {/* Doctors & Services List */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Poster Items ({joinedItems.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {joinedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllItems}
                        className="bg-red-50 hover:bg-red-100 border border-red-100 text-red-750 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Clear All</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(null);
                        setIsAddModalOpen(true);
                      }}
                      className="bg-white border border-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Doctor</span>
                    </button>
                  </div>
                </div>

                {joinedItems.map((item, idx) => {
                  const isFixed = item.itemType === "fixed_service";
                  const hasPrevDoctor = idx > 0 && joinedItems[idx - 1].itemType === "doctor";
                  const hasNextDoctor = idx < joinedItems.length - 1 && joinedItems[idx + 1].itemType === "doctor";

                  // Unicode values
                  const deptUni = item.departmentNameMalayalamUnicode;
                  const docNameUni = item.doctorNameMalayalamUnicode;
                  const qualUni = item.doctorQualificationMalayalamUnicode;
                  
                  // MVM values
                  const deptMVM = item.departmentNameMalayalamMVM;
                  const docNameMVM = item.doctorNameMalayalamMVM;
                  const qualMVM = item.doctorQualificationMalayalamMVM;

                  const timeVal = `${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;

                  // Key mapping for Copy state triggers
                  const itemKey = `item-${item.id}`;
                  const timeKey = `${itemKey}-time`;
                  
                  const deptUniKey = `${itemKey}-dept-uni`;
                  const deptMvmKey = `${itemKey}-dept-mvm`;

                  const nameUniKey = `${itemKey}-name-uni`;
                  const nameMvmKey = `${itemKey}-name-mvm`;

                  const qualUniKey = `${itemKey}-qual-uni`;
                  const qualMvmKey = `${itemKey}-qual-mvm`;

                  const blockUniKey = `${itemKey}-block-uni`;
                  const blockMvmKey = `${itemKey}-block-mvm`;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-2xl p-4 flex flex-col gap-4 shadow-xs relative overflow-hidden ${
                        isFixed ? "border-teal-150 bg-teal-50/10" : "border-slate-100"
                      }`}
                    >
                      {/* Top Bar: Controls and English Reference */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {item.departmentNameEnglish}
                          </span>
                          <h4 className="font-bold text-slate-800 text-sm">
                            {isFixed ? "Physiotherapy & Rehabilitation Outpatient" : item.doctorNameEnglish}
                          </h4>
                          {!isFixed && (
                            <p className="text-xs text-slate-500 font-medium">{item.doctorQualificationEnglish}</p>
                          )}
                        </div>

                        {/* Order & Modification controls */}
                        {!isFixed ? (
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Reordering */}
                            <div className="flex flex-col gap-1 border-r border-slate-100 pr-2 mr-1">
                              <button
                                type="button"
                                disabled={!hasPrevDoctor}
                                onClick={() => moveItem(idx, "up")}
                                className="p-1 rounded bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-all cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!hasNextDoctor}
                                onClick={() => moveItem(idx, "down")}
                                className="p-1 rounded bg-slate-50 border border-slate-100 text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-all cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Actions */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item);
                                setIsAddModalOpen(true);
                              }}
                              className="p-2 rounded-xl border border-slate-100 text-slate-650 hover:bg-slate-50 cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDoctor(item.id)}
                              className="p-2 rounded-xl border border-red-50 text-red-500 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="p-1.5 rounded-lg bg-teal-150/40 text-teal-600 flex items-center justify-center shrink-0">
                            <Lock className="h-4 w-4" />
                          </span>
                        )}
                      </div>

                      {/* Copy Fields Grid */}
                      <div className="bg-slate-50/50 border border-slate-100/50 rounded-xl p-3 flex flex-col gap-3">
                        
                        {/* Time Row */}
                        <div className="flex justify-between items-center gap-4 text-xs">
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
                              Available Time
                            </span>
                            <span className="font-semibold text-slate-750 font-mono">{timeVal}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(timeVal, timeKey)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer h-7 shrink-0 ${
                              copiedFields[timeKey]
                                ? "bg-teal-50 border-teal-100 text-teal-650"
                                : "bg-white border-slate-150 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {copiedFields[timeKey] ? (
                              <><Check className="h-3 w-3" /><span>Copied</span></>
                            ) : (
                              <><Copy className="h-3 w-3" /><span>Copy</span></>
                            )}
                          </button>
                        </div>

                        {/* Department Name Row */}
                        <div className="border-t border-slate-100/50 pt-2 flex flex-col gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                            Department
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Unicode */}
                            <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2 text-xs">
                              <span className="truncate text-slate-750 font-medium">{deptUni}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(deptUni || "", deptUniKey)}
                                className={`p-1.5 rounded border text-slate-500 transition-colors cursor-pointer ${
                                  copiedFields[deptUniKey] ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                                }`}
                              >
                                {copiedFields[deptUniKey] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                            {/* MVM */}
                            <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2 text-xs">
                              {deptMVM ? (
                                <>
                                  <span className="truncate text-teal-800 font-mono text-[11px]">{deptMVM}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(deptMVM || "", deptMvmKey)}
                                    className={`p-1.5 rounded border text-slate-500 transition-colors cursor-pointer ${
                                      copiedFields[deptMvmKey] ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                                    }`}
                                  >
                                    {copiedFields[deptMvmKey] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>MVM content missing</span>
                                  </span>
                                  <Link
                                    href="/designer/departments"
                                    className="text-[9px] font-bold text-teal-600 hover:text-teal-750 cursor-pointer"
                                  >
                                    Edit
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Doctor Name Row (only if doctor type) */}
                        {!isFixed && (
                          <div className="border-t border-slate-100/50 pt-2 flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                              Doctor Name
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Unicode */}
                              <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2 text-xs">
                                <span className="truncate text-slate-750 font-medium">{docNameUni}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(docNameUni || "", nameUniKey)}
                                  className={`p-1.5 rounded border text-slate-500 transition-colors cursor-pointer ${
                                    copiedFields[nameUniKey] ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                                  }`}
                                >
                                  {copiedFields[nameUniKey] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                              {/* MVM */}
                              <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2 text-xs">
                                {docNameMVM ? (
                                  <>
                                    <span className="truncate text-teal-800 font-mono text-[11px]">{docNameMVM}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(docNameMVM || "", nameMvmKey)}
                                      className={`p-1.5 rounded border text-slate-500 transition-colors cursor-pointer ${
                                        copiedFields[nameMvmKey] ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                                      }`}
                                    >
                                      {copiedFields[nameMvmKey] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                      <AlertCircle className="h-3 w-3" />
                                      <span>MVM content missing</span>
                                    </span>
                                    <Link
                                      href="/designer/doctors"
                                      className="text-[9px] font-bold text-teal-600 hover:text-teal-750 cursor-pointer"
                                    >
                                      Edit
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Doctor Qualification Row (only if doctor type) */}
                        {!isFixed && (
                          <div className="border-t border-slate-100/50 pt-2 flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                              Qualification
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Unicode */}
                              <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2 text-xs">
                                <span className="truncate text-slate-750 font-medium">{qualUni}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(qualUni || "", qualUniKey)}
                                  className={`p-1.5 rounded border text-slate-500 transition-colors cursor-pointer ${
                                    copiedFields[qualUniKey] ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                                  }`}
                                >
                                  {copiedFields[qualUniKey] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                              {/* MVM */}
                              <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2 text-xs">
                                {qualMVM ? (
                                  <>
                                    <span className="truncate text-teal-800 font-mono text-[11px]">{qualMVM}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(qualMVM || "", qualMvmKey)}
                                      className={`p-1.5 rounded border text-slate-500 transition-colors cursor-pointer ${
                                        copiedFields[qualMvmKey] ? "bg-teal-50 border-teal-100 text-teal-700" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                                      }`}
                                    >
                                      {copiedFields[qualMvmKey] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                      <AlertCircle className="h-3 w-3" />
                                      <span>MVM content missing</span>
                                    </span>
                                    <Link
                                      href="/designer/doctors"
                                      className="text-[9px] font-bold text-teal-600 hover:text-teal-750 cursor-pointer"
                                    >
                                      Edit
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Block Copy Controls */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => copyDoctorBlock(item, "unicode", blockUniKey)}
                          className={`py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            copiedFields[blockUniKey]
                              ? "bg-teal-50 border-teal-100 text-teal-700"
                              : "bg-white border-slate-100 hover:bg-slate-50 text-slate-650"
                          }`}
                        >
                          {copiedFields[blockUniKey] ? (
                            <><Check className="h-3.5 w-3.5" /><span>Unicode Block Copied!</span></>
                          ) : (
                            <><Copy className="h-3.5 w-3.5 text-slate-400" /><span>Copy Unicode Block</span></>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyDoctorBlock(item, "mvm", blockMvmKey)}
                          className={`py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            copiedFields[blockMvmKey]
                              ? "bg-teal-50 border-teal-100 text-teal-700"
                              : "bg-white border-slate-100 hover:bg-slate-50 text-slate-650"
                          }`}
                        >
                          {copiedFields[blockMvmKey] ? (
                            <><Check className="h-3.5 w-3.5" /><span>MVM Block Copied!</span></>
                          ) : (
                            <><Copy className="h-3.5 w-3.5 text-slate-400" /><span>Copy MVM Block</span></>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Actions, Statuses, Date Copy (Col span 4) */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              
              {/* Card 1: Workflow Action Controller */}
              <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Request Workflow
                </span>
                
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">Current Status:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        status === "completed"
                          ? "bg-teal-100/60 text-teal-800"
                          : status === "processing"
                          ? "bg-blue-50 text-blue-700 border border-blue-100"
                          : status === "submitted"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                {/* Workflow state transition actions */}
                <div className="flex flex-col gap-2.5 mt-2">
                  {status === "submitted" && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus("processing")}
                      disabled={saving}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Start Processing</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                  {status === "processing" && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus("completed")}
                      disabled={saving}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      <span>Mark as Completed</span>
                    </button>
                  )}

                  {status === "completed" && (
                    <button
                      type="button"
                      onClick={() => setShowReopenConfirm(true)}
                      disabled={saving}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center"
                    >
                      Reopen Request
                    </button>
                  )}
                </div>
              </div>

              {/* Card 1.5: Poster Generation Settings */}
              <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Poster Layout Settings
                </span>
                
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800">Physiotherapy & Rehab</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Show or hide this fixed service block on the final generated poster.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={showPhysiotherapy}
                      onChange={(e) => {
                        setShowPhysiotherapy(e.target.checked);
                        setIsPosterOutdated(true);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>
              </div>

              {/* Card 2: Poster Generation & Preview Card */}
              <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Poster Automation
                </span>

                {generating ? (
                  <div className="border border-slate-100 rounded-xl p-8 flex flex-col items-center justify-center gap-2 bg-slate-50/50">
                    <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Generating PNG...</span>
                  </div>
                ) : generatedPoster ? (
                  <div className="flex flex-col gap-3">
                    {/* Thumbnail Preview */}
                    <div 
                      onClick={() => {
                        setPreviewZoom(1);
                        setShowPreviewModal(true);
                      }}
                      className="relative border border-slate-150 rounded-xl overflow-hidden group cursor-pointer w-full bg-slate-900 flex items-center justify-center h-48"
                      style={{ aspectRatio: "4/5" }}
                    >
                      <img 
                        src={generatedPoster.downloadUrl} 
                        alt="Poster Thumbnail" 
                        className="w-full h-full object-contain transition-opacity duration-200 group-hover:opacity-75"
                      />

                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                        <span className="bg-white p-2 rounded-lg text-slate-800 shadow-lg">
                          <Eye className="h-4.5 w-4.5" />
                        </span>
                      </div>
                      <span className="absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                        v{generatedPoster.version}
                      </span>
                    </div>


                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewZoom(1);
                          setShowPreviewModal(true);
                        }}
                        className="flex-1 bg-white hover:bg-slate-50 border border-slate-150 text-slate-700 font-bold text-xs py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDownloadingPNG || generating}
                        onClick={handleDownloadPNG}
                        className="flex-1 bg-white hover:bg-slate-50 border border-slate-150 text-slate-750 font-bold text-xs py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {isDownloadingPNG ? (
                          <>
                            <div className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" />
                            <span>{isPosterOutdated ? "Download (Update)" : "Download"}</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3">
                      <ImageIcon className="h-8 w-8 text-slate-350" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-800 font-semibold">No poster generated yet</span>
                        <p className="text-[9px] text-slate-400 leading-relaxed max-w-[200px]">
                          Verify that all MVM values exist and generate the daily poster.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGeneratePoster}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Generate Poster</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Version history and regenerate button removed for simplicity */}
              </div>

              {/* Card 3: Date Copy Card */}
              <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Poster Header Date
                </span>

                {/* English Date */}
                <div className="flex justify-between items-center gap-3 text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-slate-450 uppercase mb-0.5">
                      English Format
                    </span>
                    <span className="font-semibold text-slate-700 truncate">
                      {getEnglishDateString(dateString)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(getEnglishDateString(dateString), "date-eng")}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer h-7 shrink-0 ${
                      copiedFields["date-eng"]
                        ? "bg-teal-50 border-teal-100 text-teal-650"
                        : "bg-white border-slate-150 text-slate-650 hover:bg-slate-50"
                    }`}
                  >
                    {copiedFields["date-eng"] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>

                {/* Malayalam Date */}
                <div className="flex justify-between items-center gap-3 text-xs border-t border-slate-50 pt-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-slate-450 uppercase mb-0.5">
                      Malayalam Format
                    </span>
                    <span className="font-semibold text-slate-700 font-mono truncate">
                      {getMalayalamDateString(dateString)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(getMalayalamDateString(dateString), "date-mal")}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer h-7 shrink-0 ${
                      copiedFields["date-mal"]
                        ? "bg-teal-50 border-teal-100 text-teal-650"
                        : "bg-white border-slate-150 text-slate-650 hover:bg-slate-50"
                    }`}
                  >
                    {copiedFields["date-mal"] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Card 4: Global Poster Copies */}
              <div className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col gap-3 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Global Copy Actions
                </span>

                <button
                  type="button"
                  onClick={() => copyAllPosterContent("unicode", "all-content-uni")}
                  className={`w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    copiedFields["all-content-uni"]
                      ? "bg-teal-50 border-teal-100 text-teal-700"
                      : "bg-white border-slate-100 hover:bg-slate-50 text-slate-755"
                  }`}
                >
                  {copiedFields["all-content-uni"] ? (
                    <><Check className="h-4 w-4" /><span>All Unicode Copied!</span></>
                  ) : (
                    <><Layers className="h-4 w-4 text-slate-400" /><span>Copy All Unicode Content</span></>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => copyAllPosterContent("mvm", "all-content-mvm")}
                  className={`w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    copiedFields["all-content-mvm"]
                      ? "bg-teal-50 border-teal-100 text-teal-700"
                      : "bg-white border-slate-100 hover:bg-slate-50 text-slate-755"
                  }`}
                >
                  {copiedFields["all-content-mvm"] ? (
                    <><Check className="h-4 w-4" /><span>All MVM Copied!</span></>
                  ) : (
                    <><Layers className="h-4 w-4 text-slate-400" /><span>Copy All MVM Content</span></>
                  )}
                </button>
              </div>

              {/* Card 5: Schedule Overrides (Visible if items updated) */}
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveScheduleOverrides}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-sm py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Save className="h-4.5 w-4.5" />
                <span>Save Schedule Changes</span>
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Save Success Alert */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center gap-4 shadow-2xl animate-scaleUp">
            <div className="h-12 w-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-slate-900 text-base">Poster Request Saved!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The schedule overrides for {new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" })} have been saved to Firestore.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Workflow Reopen Confirmation Modal */}
      {showReopenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center gap-4 shadow-2xl">
            <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-slate-900 text-base">Reopen Request?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to reopen this completed request? This will revert its status back to Processing.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => setShowReopenConfirm(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus("processing")}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Doctor Drawer */}
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

      {/* Validation Errors Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-slate-900 text-base">Validation Failed</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              We found missing MVM values required for poster generation. Please resolve them by following the links below:
            </p>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2.5 pr-1">
              {validationErrors.map((err, idx) => (
                <div key={idx} className="flex justify-between items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {err.type === "doctor" ? "Doctor" : "Department"}
                    </span>
                    <span className="font-bold text-slate-800 truncate">{err.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{err.field} is missing</span>
                  </div>
                  <Link
                    href={err.path}
                    className="shrink-0 bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg font-bold text-[10px] cursor-pointer transition-colors"
                  >
                    Edit Master
                  </Link>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowValidationModal(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-3 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Poster Preview Modal */}
      {showPreviewModal && generatedPoster && (() => {
        // Group items for preview
        const gpDepts: { [key: string]: any[] } = {};
        joinedItems.forEach((item) => {
          const deptName = item.departmentNameMalayalamMVM || "Other";
          if (showPhysiotherapy === false && (deptName === "^nknbmt¯d¸n & dolm_nentej³" || deptName === "^nknbmtXncm_n & dnhm_nentedj³")) return;
          if (!gpDepts[deptName]) gpDepts[deptName] = [];
          gpDepts[deptName].push(item);
        });
        const deptKeysCount = Object.keys(gpDepts).length;

        // Calculate natural height of the poster dynamically
        const previewDocRowHeight = deptKeysCount <= 3 ? 110 : deptKeysCount <= 5 ? 95 : 90;
        const rowGapVal = deptKeysCount <= 3 ? 36 : deptKeysCount <= 5 ? 24 : 20;

        let scheduleHeight = 0;
        Object.keys(gpDepts).forEach((deptName) => {
          const isPhysio = deptName === "^nknbmt¯d¸n & dolm_nentej³" || deptName === "^nknbmtXncm_n & dnhm_nentedj³";
          if (isPhysio) {
            scheduleHeight += 163;
          } else {
            const N = gpDepts[deptName].length;
            scheduleHeight += Math.max(120, 20 + N * (previewDocRowHeight + 24));
          }
        });

        if (deptKeysCount > 0) {
          scheduleHeight += (deptKeysCount - 1) * rowGapVal;
        }

        const posterHeight = Math.max(1600, 240 + scheduleHeight + 398 + 40);
        const scaledHeight = posterHeight * 0.375;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-100 flex flex-col md:flex-row shadow-2xl relative overflow-hidden my-8 animate-scaleUp animate-duration-200">
            
            {/* Left: Dynamic HTML display (scrollable if zoomed) */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-6 min-h-[400px] max-h-[85vh] overflow-auto">
              {/* Style declaration for custom fonts in browser */}
              <style>{`
                @font-face {
                  font-family: 'MLKVShaji-Bold';
                  src: url('/fonts/mlkv-shaji/MLKVShaji-Bold.ttf') format('truetype');
                }
                @font-face {
                  font-family: 'MLKVShaji-Normal';
                  src: url('/fonts/mlkv-shaji/MLKVShaji-Normal.ttf') format('truetype');
                }
                @font-face {
                  font-family: 'MVMAthira-Bold';
                  src: url('/fonts/mvm-athira/MVMAthira-Bold.ttf') format('truetype');
                }
                @font-face {
                  font-family: 'MVMAthira-Normal';
                  src: url('/fonts/mvm-athira/MVMAthira-Normal.ttf') format('truetype');
                }
                @font-face {
                  font-family: 'Gobold-Uplow';
                  src: url('/fonts/gobold/Gobold-Uplow.otf') format('opentype');
                }
                @font-face {
                  font-family: 'Gilmer-Regular';
                  src: url('/fonts/gilmer/Gilmer-Regular.otf') format('opentype');
                }
                @font-face {
                  font-family: 'Gilmer-Medium';
                  src: url('/fonts/gilmer/Gilmer-Medium.otf') format('opentype');
                }
                @font-face {
                  font-family: 'Gilmer-Bold';
                  src: url('/fonts/gilmer/Gilmer-Bold.otf') format('opentype');
                }
              `}</style>
              <div 
                className="transition-transform duration-200 origin-center shadow-2xl relative bg-[#F3EFE9] overflow-hidden rounded-lg"
                style={{ 
                  transform: `scale(${previewZoom})`,
                  width: "450px",
                  height: `${scaledHeight}px`,
                }}
              >
                {/* Scale base 1200x(posterHeight) layout down using 0.375 factor */}
                <div 
                  className="absolute top-0 left-0 bg-[#F3EFE9]"
                  style={{
                    width: "1200px",
                    height: `${posterHeight}px`,
                    transform: "scale(0.375)",
                    transformOrigin: "top left",
                    backgroundImage: "url('/header.png')",
                    backgroundSize: "100% auto",
                    backgroundPosition: "top center",
                    backgroundRepeat: "no-repeat",
                    fontFamily: "'Gilmer-Regular', sans-serif",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "240px 35px 45px 35px",
                    position: "relative",
                  }}
                >
                  {/* Date overlay absolute positioned */}
                  <div 
                    className="absolute flex flex-col justify-center text-white"
                    style={{
                      right: `${datePositionX}px`,
                      top: `${datePositionY}px`,
                      width: "210px",
                      height: "98px",
                      fontFamily: "'MVMAthira-Bold', sans-serif",
                      fontSize: "34px",
                      fontWeight: "bold",
                      lineHeight: 0.85,
                      textAlign: "left"
                    }}
                  >
                    <span style={{ fontFamily: "'MVMAthira-Bold', sans-serif", fontSize: "34px", fontWeight: "bold", lineHeight: 0.85, whiteSpace: "nowrap" }}>{calDayMonth}</span>
                    <span style={{ fontFamily: "'MVMAthira-Bold', sans-serif", fontSize: "34px", fontWeight: "bold", lineHeight: 0.85, marginTop: "0px", whiteSpace: "nowrap" }}>{calYearWeekday}</span>
                  </div>

                  {/* Dynamic Schedule Area */}
                  <div 
                    className="flex flex-col justify-center"
                    style={{
                      flex: 1,
                      gap: deptKeysCount <= 3 ? "36px" : deptKeysCount <= 5 ? "24px" : "20px",
                      margin: "15px 0 25px 0"
                    }}
                  >
                    {(() => {
                      const previewDeptKeys = Object.keys(gpDepts);
                      const previewDocRowHeight = deptKeysCount <= 3 ? "110px" : deptKeysCount <= 5 ? "95px" : "90px";

                      return previewDeptKeys.map((deptName) => {
                        const deptItems = gpDepts[deptName];
                        const isPhysio = deptName === "^nknbmt¯d¸n & dolm_nentej³" || deptName === "^nknbmtXncm_n & dnhm_nentedj³";

                        if (isPhysio) {
                          return (
                            <div 
                              key={deptName}
                              className="w-full bg-white border border-[#E4E7EB] rounded-[24px] overflow-hidden grid"
                              style={{ gridTemplateColumns: "1fr 285px", height: "163px" }}
                            >
                              <div 
                                className="py-[15px] px-[30px] flex items-center justify-start text-[#148C8C] font-bold text-[50px] leading-[0.7] overflow-hidden"
                                style={{ fontFamily: "'MVMAthira-Bold', sans-serif" }}
                              >
                                <span style={{ transform: "translateY(-14px)", display: "inline-block", width: "100%" }}>{deptName}</span>
                              </div>
                              <div className="bg-[#577C8E] flex flex-col items-center justify-center py-[4px] px-[15px]">
                                <div 
                                  className="bg-[#148C8C] text-white rounded-[8px] py-[2px] px-[12px] flex flex-col items-center justify-center text-center shadow-[0_2px_6px_rgba(20,140,140,0.15)] mb-[12px]"
                                  style={{ fontFamily: "'MVMAthira-Bold', sans-serif" }}
                                >
                                  <span className="text-[32px] leading-[1.15]" style={{ transform: "translateY(-8px)", display: "inline-block" }}>FÃm Znhkhpw</span>
                                  <span className="text-[32px] leading-[1.15]" style={{ transform: "translateY(-8px)", display: "inline-block" }}>(ªmbÀ Ah[n)</span>
                                </div>
                                <span 
                                  className="text-[27px] text-white font-bold leading-none"
                                  style={{ fontFamily: "'Gobold-Uplow', sans-serif" }}
                                >
                                  9:00 AM - 5:00 PM
                                </span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={deptName}
                            className="grid"
                            style={{
                              gridTemplateColumns: "310px 535px 285px",
                              width: "100%"
                            }}
                          >
                            <div className="flex items-center justify-center">
                              <div 
                                  className="bg-[#577C8E] text-white rounded-l-[24px] w-full h-[120px] flex items-center justify-start py-[15px] px-[20px] text-left leading-[1.0] font-bold shadow-[0_4px_10px_rgba(74,107,130,0.15)] overflow-hidden"
                                  style={{
                                    fontFamily: "'MVMAthira-Bold', sans-serif",
                                    fontSize: "42px",
                                    whiteSpace: "normal",
                                    wordBreak: "keep-all",
                                    overflowWrap: "break-word"
                                  }}
                                >
                                  <span style={{ transform: "translateY(-10px)", display: "inline-block", width: "100%" }}>{deptName}</span>
                                </div>
                              </div>

                              {/* Middle: Doctors Card */}
                              <div 
                                className="bg-white border-y border-[#E4E7EB] py-[10px] px-[35px] flex flex-col justify-around shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                              >
                                {deptItems.map((item, idx) => {
                                  const docName = item.doctorNameMalayalamMVM || "[Missing Name]";
                                  const qual = item.doctorQualificationEnglish || "";
                                  return (
                                    <React.Fragment key={item.id}>
                                      {idx > 0 && <div className="h-[1px] bg-[#E2E8F0] w-full" />}
                                      <div 
                                        className="flex flex-col justify-center"
                                        style={{ minHeight: previewDocRowHeight, padding: "12px 0", transform: "translateY(-8px)" }}
                                      >
                                        <div 
                                          className="text-[#305C71] font-bold leading-[1.0]"
                                          style={{
                                            fontFamily: "'MLKVShaji-Bold', sans-serif",
                                            fontSize: "50px"
                                          }}
                                        >
                                          {docName}
                                        </div>
                                        {qual && (
                                          <div 
                                            className="text-[#95B6C7] mt-[4px] leading-[0.9]"
                                            style={{
                                              fontFamily: "'Gilmer-Medium', sans-serif",
                                              fontSize: "24px",
                                              wordBreak: "break-word"
                                            }}
                                          >
                                            {qual}
                                          </div>
                                        )}
                                      </div>
                                    </React.Fragment>
                                  );
                                })}
                              </div>

                              {/* Right: Time Badges */}
                              <div 
                                className="flex flex-col h-full"
                                style={deptItems.length > 1 ? { gap: "12px" } : {}}
                              >
                                {deptItems.map((item) => {
                                  const timeStr = `${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;
                                  const borderRadius = deptItems.length === 1 ? "0 24px 24px 0" : "0 20px 20px 0";
                                  return (
                                    <div key={item.id} className="flex flex-1 w-full">
                                      <div 
                                        className="bg-[#577C8E] text-white w-full h-full flex items-center justify-center font-bold text-center p-[10px] shadow-[0_4px_10px_rgba(74,107,130,0.15)]"
                                        style={{
                                          borderRadius,
                                          fontFamily: "'Gobold-Uplow', sans-serif",
                                          fontSize: "27px"
                                        }}
                                      >
                                        <span>{timeStr}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Footer */}
                    <div className="w-full h-[353px]">
                      <img src="/footer.png" className="w-full h-full object-fill" alt="Footer" />
                    </div>
                  </div>
                </div>
              </div>

            {/* Right: Controls & Info */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-100 p-6 flex flex-col justify-between bg-slate-50/50">
              <div className="flex flex-col gap-5">
                <div className="flex justify-between items-center pb-3 border-b border-slate-150">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preview</span>
                    <h3 className="font-bold text-slate-900 text-base">Poster v{generatedPoster.version}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-3 text-xs text-slate-650">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">File Path</span>
                    <span className="font-mono text-slate-800 break-all select-all bg-white p-2 rounded-lg border border-slate-150">{generatedPoster.storagePath}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Generated At</span>
                    <span className="font-semibold text-slate-850">
                      {generatedPoster.generatedAt?.toDate ? generatedPoster.generatedAt.toDate().toLocaleString() : "Just now"}
                    </span>
                  </div>
                </div>

                {/* Adjust Date Position Option Panel */}
                <div className="bg-slate-100 border border-slate-200/60 rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Adjust Date Position
                    </span>
                    <button
                      type="button"
                      disabled={isSavingPosition}
                      onClick={handleSavePosition}
                      className="text-[9px] text-teal-650 hover:text-teal-700 font-bold cursor-pointer flex items-center gap-0.5 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs transition-colors h-6"
                    >
                      {positionSavedFeedback ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <span>{isSavingPosition ? "Saving..." : "Save"}</span>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-[8px] font-semibold text-slate-400">
                        <span>Top Offset (Y)</span>
                        <span className="font-bold text-slate-650">{datePositionY}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="400"
                        value={datePositionY}
                        onChange={(e) => {
                          setDatePositionY(parseInt(e.target.value, 10));
                          setIsPosterOutdated(true);
                        }}
                        className="w-full accent-teal-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                      />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-[8px] font-semibold text-slate-400">
                        <span>Right Offset (X)</span>
                        <span className="font-bold text-slate-650">{datePositionX}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="400"
                        value={datePositionX}
                        onChange={(e) => {
                          setDatePositionX(parseInt(e.target.value, 10));
                          setIsPosterOutdated(true);
                        }}
                        className="w-full accent-teal-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-455 uppercase shrink-0 pr-1">Zoom</span>
                  <button
                    type="button"
                    disabled={previewZoom <= 0.75}
                    onClick={() => setPreviewZoom((z) => z - 0.25)}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold hover:bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-semibold text-slate-700 font-mono w-10 text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    disabled={previewZoom >= 2.0}
                    onClick={() => setPreviewZoom((z) => z + 0.25)}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-bold hover:bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5 mt-6 md:mt-0">
                <button
                  type="button"
                  disabled={isDownloadingPNG || generating}
                  onClick={handleDownloadPNG}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {isDownloadingPNG || generating ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isDownloadingPNG ? "Regenerating & Downloading..." : "Regenerating..."}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>{isPosterOutdated ? "Download PNG (Regenerating)" : "Download PNG"}</span>
                    </>
                  )}
                </button>

                {status !== "completed" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUpdateStatus("completed");
                      setShowPreviewModal(false);
                    }}
                    className="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirm Completion</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
}

// Icon fallbacks inside file for portability
function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function RequestDetailsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white">
        <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold mt-2">Loading content workspace...</span>
      </div>
    }>
      <RequestDetailsContent />
    </Suspense>
  );
}
