"use client";

import React, { useState, useEffect } from "react";
import {
  fetchAllDoctors,
  fetchAllDepartments,
  saveDoctor,
  saveDepartment,
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

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Manage Doctors</h2>
          <p className="text-xs text-slate-500 mt-0.5">Edit credentials and MVM print data</p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* Bulk Actions Panel */}
      <div className="bg-white border border-slate-105 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
      ) : filteredDoctors.length === 0 ? (
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
        <div className="flex flex-col gap-3">
          {filteredDoctors.map((docItem) => {
            const dept = departments.find((d) => d.id === docItem.departmentId);
            const isNameMvmReady = Boolean(docItem.nameMalayalamMVM);
            
            return (
              <div
                key={docItem.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  {/* Name and Meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{docItem.nameEnglish}</span>
                    <span className="text-[10px] font-semibold text-teal-650 bg-teal-50/50 px-2 py-0.5 rounded-full border border-teal-100/30">
                      {dept ? dept.nameEnglish : "Unknown Department"}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        docItem.isActive
                          ? "bg-teal-50 text-teal-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {docItem.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Credentials / Details */}
                  <div className="text-xs text-slate-550 font-medium">
                    {docItem.qualificationEnglish}
                  </div>

                  {/* MVM Checklist */}
                  <div className="flex flex-col gap-1 text-[11px] mt-1 border-t border-slate-50 pt-1.5">
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="font-semibold text-[9px] uppercase text-slate-400">Name MVM (Malayalam Preview):</span>
                      {isNameMvmReady ? (
                        <span className="text-slate-800 bg-teal-50/40 px-2.5 py-1 rounded text-base border border-teal-100/30" style={{ fontFamily: "MLKVShaji-Bold" }}>
                          {docItem.nameMalayalamMVM}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded flex items-center gap-0.5">
                          <AlertCircle className="h-2.5 w-2.5" />
                          <span>MVM Missing</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(docItem)}
                  className="p-2.5 rounded-xl border border-slate-100 text-slate-650 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
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
                  onChange={(e) => setDepartmentId(e.target.value)}
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
    </div>
  );
}
