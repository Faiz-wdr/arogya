"use client";

import React, { useState, useEffect } from "react";
import {
  fetchAllDoctors,
  fetchAllDepartments,
  saveDoctor,
  saveDepartment,
  deleteDoctor,
  deleteDepartment,
  clearDoctorsAndDepartments,
  Doctor,
  Department
} from "@/lib/services/db";
import {
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Filter,
  Upload,
  Download,
  Trash2
} from "lucide-react";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);

  // Form State
  const [departmentId, setDepartmentId] = useState("");
  const [nameEnglish, setNameEnglish] = useState("");
  const [nameMalayalamUnicode, setNameMalayalamUnicode] = useState("");
  const [nameMalayalamMVM, setNameMalayalamMVM] = useState("");
  const [qualificationEnglish, setQualificationEnglish] = useState("");
  const [qualificationMalayalamUnicode, setQualificationMalayalamUnicode] = useState("");
  const [qualificationMalayalamMVM, setQualificationMalayalamMVM] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Warnings & Saving State
  const [deactivationWarning, setDeactivationWarning] = useState<string | null>(null);
  const [inactiveDeptWarning, setInactiveDeptWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Department Manager States
  const [showDeptManager, setShowDeptManager] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptNameEnglish, setDeptNameEnglish] = useState("");
  const [deptNameMalayalamMVM, setDeptNameMalayalamMVM] = useState("");
  const [deptDisplayOrder, setDeptDisplayOrder] = useState(1);
  const [deptIsActive, setDeptIsActive] = useState(true);
  const [deptFormError, setDeptFormError] = useState<string | null>(null);
  const [deptSaving, setDeptSaving] = useState(false);

  // Inline Add Department States
  const [showInlineAddDept, setShowInlineAddDept] = useState(false);
  const [inlineDeptNameEnglish, setInlineDeptNameEnglish] = useState("");
  const [inlineDeptNameMalayalamMVM, setInlineDeptNameMalayalamMVM] = useState("");
  const [inlineDeptSaving, setInlineDeptSaving] = useState(false);
  const [inlineDeptError, setInlineDeptError] = useState<string | null>(null);

  // Bulk Import & Reset State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

  // Helper to parse CSV string to matrix
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  // Trigger browser download for sample CSV
  const downloadSampleCSV = () => {
    const headers = [
      "Doctor Name",
      "Doctor Name MVM",
      "Qualification",
      "Department",
      "Department MVM"
    ];
    
    const sampleRows = [
      ["ഡോ. മേബിൾ ജോൺ", "tUm. ta_nÄ tPmt¬", "MBBS", "ജനറൽ ഒ.പി", "P\\dÄ H.¸n."],
      ["ഡോ. സുജീഷ് ബി രാജ്", "tUm. kyPojv _n cmtPv", "MBBS", "ജനറൽ ഒ.പി", "P\\dÄ H.¸n."],
      ["ഡോ. മുഹമ്മദ് സാജിദ്", "tUm. apl½Zv kmlnZv", "BDS (Dental Surgeon)", "ദന്തവിഭാഗം", "Z´tcmK hn`mKw"]
    ];
    
    // Add BOM for UTF-8 compatibility with Excel
    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "arogya_doctors_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear Firestore doctors and departments
  const handleClearDatabase = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await clearDoctorsAndDepartments();
      setIsResetConfirmOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setFormError("Failed to reset database. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Upload CSV and save to Firestore, deduplicating departments case-insensitively
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadErrorMessage(null);
    setUploadSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error("Could not read file contents");
        }

        const rawRows = parseCSV(text);
        if (rawRows.length <= 1) {
          throw new Error("CSV file is empty or missing data rows");
        }

        // Skip headers
        const dataRows = rawRows.slice(1).filter(row => row.some(cell => cell.trim() !== ""));

        // Fetch existing departments for case-insensitive deduplication
        const existingDepts = await fetchAllDepartments();
        const deptCache = new Map<string, string>();
        existingDepts.forEach(d => {
          deptCache.set(d.nameEnglish.trim().toLowerCase(), d.id);
        });

        let deptAddedCount = 0;
        let docAddedCount = 0;

        for (const row of dataRows) {
          // Columns:
          // 0: Doctor Name (Malayalam Unicode)
          // 1: Doctor Name MVM
          // 2: Qualification (Malayalam Unicode/English)
          // 3: Department (Malayalam Unicode)
          // 4: Department MVM

          const docName = row[0]?.trim() || "";
          const docNameMVM = row[1]?.trim() || "";
          const qual = row[2]?.trim() || "";
          const deptName = row[3]?.trim() || "";
          const deptMVM = row[4]?.trim() || "";

          if (!docName || !qual || !deptName) {
            continue; // Skip lines missing required inputs
          }

          // Case-insensitive check on Department Name
          const deptKey = deptName.toLowerCase();
          let deptId = deptCache.get(deptKey);

          if (!deptId) {
            deptId = `dept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await saveDepartment(deptId, {
              nameEnglish: deptName,
              nameMalayalamUnicode: deptName,
              nameMalayalamMVM: deptMVM,
              displayOrder: deptCache.size + 1,
              isActive: true,
              aliases: [deptName]
            });
            deptCache.set(deptKey, deptId);
            deptAddedCount++;
          }

          // Doctor aliases defaults to Doctor Name
          const aliases = [docName];

          const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await saveDoctor(docId, {
            departmentId: deptId,
            nameEnglish: docName,
            nameMalayalamUnicode: docName,
            nameMalayalamMVM: docNameMVM,
            qualificationEnglish: qual,
            qualificationMalayalamUnicode: qual,
            qualificationMalayalamMVM: "", // Redundant - removed from template/form
            isActive: true,
            aliases
          });

          docAddedCount++;
        }

        setUploadSuccessMessage(`Successfully imported ${docAddedCount} doctors and ${deptAddedCount} new departments!`);
        await loadData();
      } catch (err: any) {
        console.error(err);
        setUploadErrorMessage(err.message || "Failed to process CSV file.");
      } finally {
        setUploading(false);
        if (e.target) {
          e.target.value = "";
        }
      }
    };

    reader.onerror = () => {
      setUploadErrorMessage("Failed to read the file.");
      setUploading(false);
    };

    reader.readAsText(file);
  };

  // Load database data
  const loadData = async () => {
    setLoading(true);
    try {
      const docsData = await fetchAllDoctors();
      const deptsData = await fetchAllDepartments();
      setDoctors(docsData);
      setDepartments(deptsData);
    } catch (error) {
      console.error("Error loading doctor data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingDoc(null);
    setDepartmentId("");
    setNameEnglish("");
    setQualificationEnglish("");
    setQualificationMalayalamMVM("");
    setIsActive(true);
    setFormError(null);
    setDeactivationWarning(null);
    setInactiveDeptWarning(null);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (docItem: Doctor) => {
    setEditingDoc(docItem);
    setDepartmentId(docItem.departmentId);
    setNameEnglish(docItem.nameEnglish);
    setNameMalayalamMVM(docItem.nameMalayalamMVM || "");
    setQualificationEnglish(docItem.qualificationEnglish);
    setQualificationMalayalamMVM(docItem.qualificationMalayalamMVM || "");
    setIsActive(docItem.isActive);
    setFormError(null);
    setDeactivationWarning(null);
    setInactiveDeptWarning(null);
    setIsModalOpen(true);
  };

  // Watch for deactivation warnings
  useEffect(() => {
    if (editingDoc && !isActive && editingDoc.isActive) {
      setDeactivationWarning(
        "Warning: Deactivating this doctor will hide them in the Staff Portal selection."
      );
    } else {
      setDeactivationWarning(null);
    }
  }, [isActive, editingDoc]);

  // Watch for inactive department warning
  useEffect(() => {
    if (departmentId && isActive) {
      const selectedDept = departments.find((d) => d.id === departmentId);
      if (selectedDept && !selectedDept.isActive) {
        setInactiveDeptWarning(
          "Warning: The selected department is inactive. This doctor will not appear in the Staff Portal until Gynaecology/Department is activated."
        );
      } else {
        setInactiveDeptWarning(null);
      }
    } else {
      setInactiveDeptWarning(null);
    }
  }, [departmentId, isActive, departments]);

  // Submit doctor form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    if (!departmentId || !nameEnglish || !qualificationEnglish) {
      setFormError("Please fill in the doctor name and qualification.");
      setSaving(false);
      return;
    }

    try {
      await saveDoctor(editingDoc ? editingDoc.id : "", {
        departmentId,
        nameEnglish,
        nameMalayalamUnicode: nameEnglish,
        nameMalayalamMVM,
        qualificationEnglish,
        qualificationMalayalamUnicode: qualificationEnglish,
        qualificationMalayalamMVM,
        isActive,
      });

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      console.error("Error saving doctor:", error);
      setFormError("Failed to save doctor details. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Filter list
  const filteredDoctors = doctors.filter((d) => {
    const matchesSearch =
      d.nameEnglish.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.qualificationEnglish.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDept = selectedDeptId ? d.departmentId === selectedDeptId : true;
    return matchesSearch && matchesDept;
  });

  // Group doctors by department
  const groupedDocs: {
    departmentId: string;
    departmentNameEnglish: string;
    departmentNameMalayalamUnicode: string;
    items: Doctor[];
  }[] = [];

  filteredDoctors.forEach((docItem) => {
    const dept = departments.find((d) => d.id === docItem.departmentId);
    const deptNameEng = dept ? dept.nameEnglish : "Unknown Department";
    const deptNameMal = dept ? dept.nameMalayalamUnicode : "Unknown Department";
    const existingGroup = groupedDocs.find((g) => g.departmentId === docItem.departmentId);

    if (existingGroup) {
      existingGroup.items.push(docItem);
    } else {
      groupedDocs.push({
        departmentId: docItem.departmentId,
        departmentNameEnglish: deptNameEng,
        departmentNameMalayalamUnicode: deptNameMal,
        items: [docItem],
      });
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Doctors and Departments</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDeptNameEnglish("");
              setDeptNameMalayalamMVM("");
              setDeptDisplayOrder(departments.length + 1);
              setDeptIsActive(true);
              setDeptFormError(null);
              setShowDeptManager(true);
            }}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors h-10"
          >
            <span>Manage Departments</span>
          </button>
          
          <button
            type="button"
            onClick={handleOpenAdd}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors h-10"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Add Doctor</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Panel */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-slate-800">Bulk Actions</h3>
          <p className="text-xs text-slate-500">
            Import multiple doctors from a CSV file template or reset the doctors and departments database collections.
          </p>
          {(uploadSuccessMessage || uploadErrorMessage) && (
            <div className="mt-2">
              {uploadSuccessMessage && (
                <span className="text-[11px] font-bold text-emerald-650 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 animate-bounce" />
                  <span>{uploadSuccessMessage}</span>
                </span>
              )}
              {uploadErrorMessage && (
                <span className="text-[11px] font-bold text-red-650 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                  <span>{uploadErrorMessage}</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={downloadSampleCSV}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors h-10"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download CSV Sample</span>
          </button>

          <label className="bg-teal-50 hover:bg-teal-100/70 border border-teal-150 text-teal-700 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all h-10 select-none">
            <Upload className="h-4 w-4 text-teal-650 animate-pulse" />
            <span>{isUploading ? "Uploading..." : "Upload CSV"}</span>
            <input
              type="file"
              accept=".csv"
              disabled={isUploading}
              onChange={handleCSVUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="bg-red-50 hover:bg-red-100/70 border border-red-150 text-red-650 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors h-10"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            <span>Delete All Records</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search doctors by name or credential..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm bg-white placeholder:text-slate-400 h-11"
          />
        </div>

        {/* Dept Filter */}
        <div className="relative flex items-center">
          <Filter className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm bg-white text-slate-700 h-11 appearance-none"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.nameEnglish} {dept.isActive ? "" : "(Inactive)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Doctor Records List */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-16 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold mt-1">Loading doctor records...</span>
        </div>
      ) : groupedDocs.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3.5 rounded-full bg-teal-50/40 text-teal-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-slate-800 text-sm">No Doctors Found</h4>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Try adjusting your filters or add a new doctor record to the system database.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {groupedDocs.map((group) => (
            <div
              key={group.departmentId}
              className="w-full bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs flex flex-col p-5"
            >
              {/* Department Header Badge */}
              <div className="pb-2.5 border-b border-slate-100 flex justify-between items-center mb-3.5">
                <span className="text-xs font-bold text-[#029688] uppercase tracking-wider">
                  {group.departmentNameMalayalamUnicode || group.departmentNameEnglish}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {group.items.length} {group.items.length === 1 ? "Doctor" : "Doctors"}
                </span>
              </div>

              {/* Doctors List inside the Department Card */}
              <div className="flex flex-col gap-3">
                {group.items.map((docItem, docIdx) => {
                  const isNameMvmReady = Boolean(docItem.nameMalayalamMVM);

                  return (
                    <div
                      key={docItem.id}
                      className={`flex items-center justify-between gap-4 py-2 ${
                        docIdx > 0 ? "border-t border-slate-100 pt-3.5" : ""
                      }`}
                    >
                      {/* Left: Names & Credentials */}
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Malayalam Unicode Name */}
                          <span className="font-bold text-slate-800 text-sm leading-tight">
                            {docItem.nameMalayalamUnicode || docItem.nameEnglish}
                          </span>
                          
                          {/* Active Status Badge */}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              docItem.isActive
                                ? "bg-teal-50 text-teal-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {docItem.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {/* Qualification */}
                        <div className="text-xs text-slate-500 font-medium">
                          {docItem.qualificationEnglish}
                        </div>
                      </div>

                      {/* Right: MVM Preview and Action Button */}
                      <div className="flex items-center gap-3.5 shrink-0">
                        {/* MVM Preview */}
                        <div>
                          {isNameMvmReady ? (
                            <span 
                              className="text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg text-base border border-slate-100 font-bold block" 
                              style={{ fontFamily: "MLKVShaji-Bold" }}
                              title="MVM Name Preview"
                            >
                              {docItem.nameMalayalamMVM}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>MVM Missing</span>
                            </span>
                          )}
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(docItem)}
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#029688] transition-all cursor-pointer shrink-0 bg-white shadow-2xs flex items-center justify-center h-9 w-9"
                          title="Edit Doctor"
                        >
                          <Edit2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Doctor Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingDoc ? "Edit Doctor Details" : "Add Doctor Record"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-teal-50/30 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              
              {/* Form Errors */}
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 flex items-start gap-2">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Warnings */}
              {deactivationWarning && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700 flex items-start gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                  <span>{deactivationWarning}</span>
                </div>
              )}

              {inactiveDeptWarning && (
                <div className="p-3.5 rounded-xl bg-amber-55 border border-amber-100 text-xs font-semibold text-amber-750 flex items-start gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                  <span>{inactiveDeptWarning}</span>
                </div>
              )}

              {/* Department Selection */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="deptSelection" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Assigned Department
                </label>
                <select
                  id="deptSelection"
                  value={departmentId}
                  onChange={(e) => {
                    if (e.target.value === "add_new_department_trigger") {
                      setShowInlineAddDept(true);
                    } else {
                      setDepartmentId(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  required
                >
                  <option value="">Select Department</option>
                  {departments
                    .filter((d) => d.id !== "dept_physiotherapy")
                    .map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.nameEnglish} {dept.isActive ? "" : "(Inactive)"}
                      </option>
                    ))}
                  <option value="add_new_department_trigger" className="text-teal-600 font-bold font-semibold">
                    + Add New Department...
                  </option>
                </select>
              </div>

              {/* Doctor Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="docNameEng" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Doctor Name (Malayalam Unicode)
                </label>
                <input
                  id="docNameEng"
                  type="text"
                  placeholder="e.g. ഡോ. രാഹുൽ കൃഷ്ണൻ"
                  value={nameEnglish}
                  onChange={(e) => setNameEnglish(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  required
                />
              </div>

              {/* Malayalam MVM Name */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="docNameMalMvm" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Doctor Name MVM (Optional)
                  </label>
                  {!nameMalayalamMVM && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded uppercase tracking-wider">
                      Missing
                    </span>
                  )}
                </div>
                <input
                  id="docNameMalMvm"
                  type="text"
                  placeholder="e.g. tUm. cmlp¬ IrjvW³"
                  value={nameMalayalamMVM}
                  onChange={(e) => setNameMalayalamMVM(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11 font-mono"
                />
              </div>

              {/* Qualification */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="qualEng" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Qualification (Malayalam Unicode / English)
                </label>
                <input
                  id="qualEng"
                  type="text"
                  placeholder="e.g. MBBS, MD"
                  value={qualificationEnglish}
                  onChange={(e) => setQualificationEnglish(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  required
                />
              </div>

              {/* Active Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Status
                </label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-full font-semibold text-sm rounded-xl py-2.5 transition-colors border h-11 cursor-pointer flex items-center justify-center gap-1.5 ${
                    isActive
                      ? "bg-teal-50 border-teal-150 text-teal-700"
                      : "bg-red-50 border-red-150 text-red-750"
                  }`}
                >
                  {isActive ? (
                    <>
                      <CheckCircle2 className="h-4.5 w-4.5" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4.5 w-4.5" />
                      <span>Inactive</span>
                    </>
                  )}
                </button>
              </div>

              {/* Form Action Buttons */}
              <div className="flex gap-3 mt-4 shrink-0 pb-2">
                {editingDoc && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to completely delete the doctor record for ${editingDoc.nameEnglish}? This action cannot be undone.`)) {
                        try {
                          setSaving(true);
                          await deleteDoctor(editingDoc.id);
                          setIsModalOpen(false);
                          await loadData();
                        } catch (err) {
                          console.error("Failed to delete doctor:", err);
                          alert("Failed to delete doctor. Please try again.");
                        } finally {
                          setSaving(false);
                        }
                      }
                    }}
                    className="bg-red-50 hover:bg-red-100 border border-red-150 text-red-650 font-bold text-xs rounded-xl py-3 px-4 transition-colors cursor-pointer h-11 flex items-center justify-center gap-1.5 shrink-0"
                    title="Delete Doctor Record"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                    <span>Delete</span>
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white hover:bg-teal-50/30 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl py-3 transition-colors cursor-pointer h-11 flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold text-sm rounded-xl py-3 transition-colors cursor-pointer h-11 flex items-center justify-center"
                >
                  {saving ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Save Doctor"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center gap-4 shadow-2xl animate-scaleUp">
            <div className="h-12 w-12 rounded-full bg-red-50 text-red-650 flex items-center justify-center shrink-0">
              <AlertCircle className="h-7 w-7 animate-pulse" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-slate-900 text-base">Purge Database Records?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This action will delete all doctors and departments from the database. <strong>This cannot be undone.</strong>
              </p>
            </div>
            
            <div className="w-full flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleClearDatabase}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold text-xs rounded-xl py-3 transition-colors cursor-pointer h-11 shadow-xs"
              >
                {saving ? "Purging..." : "Yes, Purge All"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Department Management Modal Drawer */}
      {showDeptManager && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-100 shadow-2xl flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Manage Departments</h3>
              <button
                type="button"
                onClick={() => {
                  setShowDeptManager(false);
                  setEditingDept(null);
                  setDeptNameEnglish("");
                  setDeptNameMalayalamMVM("");
                  setDeptDisplayOrder(1);
                  setDeptIsActive(true);
                  setDeptFormError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-teal-50/30 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body: Split into Form (Top/Left) and List (Bottom/Right) */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
              {/* Inline Form */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setDeptFormError(null);
                  setDeptSaving(true);
                  try {
                    const finalId = editingDept ? editingDept.id : "";
                    await saveDepartment(finalId, {
                      nameEnglish: deptNameEnglish,
                      nameMalayalamUnicode: deptNameEnglish,
                      nameMalayalamMVM: deptNameMalayalamMVM,
                      displayOrder: editingDept ? editingDept.displayOrder : (departments.length + 1),
                      isActive: deptIsActive,
                    });
                    
                    // Reset Form
                    setEditingDept(null);
                    setDeptNameEnglish("");
                    setDeptNameMalayalamMVM("");
                    setDeptDisplayOrder(departments.length + 1);
                    setDeptIsActive(true);
                    
                    // Reload Data
                    await loadData();
                  } catch (err) {
                    console.error(err);
                    setDeptFormError("Failed to save department.");
                  } finally {
                    setDeptSaving(false);
                  }
                }}
                className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-4 shadow-3xs"
              >
                <h4 className="text-xs font-bold text-[#029688] uppercase tracking-wider">
                  {editingDept ? "Edit Department" : "Add New Department"}
                </h4>

                {deptFormError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <span>{deptFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Department Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="deptNameEng" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Department Name (Malayalam Unicode)
                    </label>
                    <input
                      id="deptNameEng"
                      type="text"
                      placeholder="e.g. ജനറൽ ഒ.പി"
                      value={deptNameEnglish}
                      onChange={(e) => setDeptNameEnglish(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs text-slate-900 bg-white h-10"
                      required
                    />
                  </div>

                  {/* Malayalam MVM Value */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="deptNameMalMvm" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Malayalam MVM (Optional)
                    </label>
                    <input
                      id="deptNameMalMvm"
                      type="text"
                      placeholder="e.g. P\\dÄ H.¸n."
                      value={deptNameMalayalamMVM}
                      onChange={(e) => setDeptNameMalayalamMVM(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs text-slate-900 bg-white h-10 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  {/* Active Toggle & Save Button */}
                  <div className="flex gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={() => setDeptIsActive(!deptIsActive)}
                      className={`flex-1 font-semibold text-xs rounded-xl py-2 transition-all border h-10 cursor-pointer flex items-center justify-center gap-1 ${
                        deptIsActive
                          ? "bg-teal-50 border-teal-150 text-teal-700"
                          : "bg-red-50 border-red-150 text-red-750"
                      }`}
                    >
                      {deptIsActive ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Inactive</span>
                        </>
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={deptSaving}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-xs rounded-xl py-2 transition-all cursor-pointer h-10 flex items-center justify-center animate-fadeIn"
                    >
                      {deptSaving ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span>{editingDept ? "Save Changes" : "Add Dept"}</span>
                      )}
                    </button>

                    {editingDept && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDept(null);
                          setDeptNameEnglish("");
                          setDeptNameMalayalamMVM("");
                          setDeptDisplayOrder(departments.length + 1);
                          setDeptIsActive(true);
                        }}
                        className="bg-white hover:bg-slate-50 border border-slate-100 text-slate-650 font-bold text-xs rounded-xl py-2 px-3 transition-colors cursor-pointer h-10 flex items-center justify-center"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </form>

              {/* Department Directory List */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Clinic Directory List ({departments.length})
                </h4>

                <div className="flex flex-col gap-2">
                  {departments.map((dept) => {
                    const docCount = doctors.filter((d) => d.departmentId === dept.id).length;
                    return (
                      <div
                        key={dept.id}
                        className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4 shadow-3xs"
                      >
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {dept.nameEnglish}
                            </span>
                            


                            <span className="text-[9px] font-bold bg-slate-50 border border-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              {docCount} {docCount === 1 ? "Doctor" : "Doctors"}
                            </span>

                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                dept.isActive
                                  ? "bg-teal-50 text-teal-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {dept.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>

                          {dept.nameMalayalamMVM && (
                            <span className="text-[9.5px] text-slate-400 font-mono">
                              MVM: {dept.nameMalayalamMVM}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDept(dept);
                              setDeptNameEnglish(dept.nameEnglish);
                              setDeptNameMalayalamMVM(dept.nameMalayalamMVM || "");
                              setDeptDisplayOrder(dept.displayOrder);
                              setDeptIsActive(dept.isActive);
                            }}
                            className="p-1.5 rounded-lg border border-slate-100 text-slate-650 hover:bg-slate-50 transition-colors cursor-pointer bg-white h-8 w-8 flex items-center justify-center"
                            title="Edit Department"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          
                          <button
                            type="button"
                            disabled={dept.id === "dept_physiotherapy"}
                            onClick={async () => {
                              // Safeguard: Check if any doctor is assigned to this department
                              const assignedDocs = doctors.filter((d) => d.departmentId === dept.id);
                              if (assignedDocs.length > 0) {
                                alert(`Cannot delete this department because it still has ${assignedDocs.length} doctor records assigned to it. Please reassign or delete those doctors first.`);
                                return;
                              }
                              if (window.confirm(`Are you sure you want to completely delete the department "${dept.nameEnglish}"?`)) {
                                try {
                                  setDeptSaving(true);
                                  await deleteDepartment(dept.id);
                                  await loadData();
                                } catch (err) {
                                  console.error(err);
                                  alert("Failed to delete department.");
                                } finally {
                                  setDeptSaving(false);
                                }
                              }
                            }}
                            className="p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer bg-white h-8 w-8 flex items-center justify-center"
                            title="Delete Department"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Inline Add Department Dialog Modal */}
      {showInlineAddDept && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-4 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add New Department</h3>
              <button
                type="button"
                onClick={() => {
                  setShowInlineAddDept(false);
                  setInlineDeptNameEnglish("");
                  setInlineDeptNameMalayalamMVM("");
                  setInlineDeptError(null);
                  setDepartmentId(""); // Reset select choice
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {inlineDeptError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-650">
                {inlineDeptError}
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Department Name (Malayalam Unicode)
              </label>
              <input
                type="text"
                placeholder="e.g. ജനറൽ ഒ.പി"
                value={inlineDeptNameEnglish}
                onChange={(e) => setInlineDeptNameEnglish(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs text-slate-900 bg-white h-10"
                required
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Malayalam MVM (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. P\\dÄ H.¸n."
                value={inlineDeptNameMalayalamMVM}
                onChange={(e) => setInlineDeptNameMalayalamMVM(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs text-slate-900 bg-white h-10 font-mono"
              />
            </div>
            
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowInlineAddDept(false);
                  setInlineDeptNameEnglish("");
                  setInlineDeptNameMalayalamMVM("");
                  setInlineDeptError(null);
                  setDepartmentId(""); // Reset select choice
                }}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl py-2.5 transition-colors cursor-pointer h-10 flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={inlineDeptSaving || !inlineDeptNameEnglish}
                onClick={async () => {
                  setInlineDeptSaving(true);
                  setInlineDeptError(null);
                  try {
                    const newDeptId = await saveDepartment("", {
                      nameEnglish: inlineDeptNameEnglish,
                      nameMalayalamUnicode: inlineDeptNameEnglish,
                      nameMalayalamMVM: inlineDeptNameMalayalamMVM,
                      displayOrder: departments.length + 1,
                      isActive: true,
                    });
                    
                    // Reload departments in page data
                    await loadData();
                    
                    // Automatically select the new department
                    setDepartmentId(newDeptId);
                    
                    // Close inline modal
                    setShowInlineAddDept(false);
                    setInlineDeptNameEnglish("");
                    setInlineDeptNameMalayalamMVM("");
                  } catch (err: any) {
                    console.error(err);
                    setInlineDeptError("Failed to save department. Please try again.");
                  } finally {
                    setInlineDeptSaving(false);
                  }
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-xs rounded-xl py-2.5 transition-colors cursor-pointer h-10 flex items-center justify-center"
              >
                {inlineDeptSaving ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
