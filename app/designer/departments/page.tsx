"use client";

import React, { useState, useEffect } from "react";
import {
  fetchAllDepartments,
  saveDepartment,
  hasActiveDoctors,
  checkDepartmentNameDuplicate,
  Department
} from "@/lib/services/db";
import {
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  Building2,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  
  // Form State
  const [nameEnglish, setNameEnglish] = useState("");
  const [nameMalayalamUnicode, setNameMalayalamUnicode] = useState("");
  const [nameMalayalamMVM, setNameMalayalamMVM] = useState("");
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  // Warning & Error State
  const [deactivationWarning, setDeactivationWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load departments
  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await fetchAllDepartments();
      setDepartments(data);
    } catch (error) {
      console.error("Error loading departments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingDept(null);
    setNameEnglish("");
    setNameMalayalamMVM("");
    // Default display order to next increment
    const maxOrder = departments.reduce((max, d) => (d.displayOrder > max ? d.displayOrder : max), 0);
    setDisplayOrder(maxOrder + 1);
    setIsActive(true);
    setFormError(null);
    setDeactivationWarning(null);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setNameEnglish(dept.nameEnglish);
    setNameMalayalamMVM(dept.nameMalayalamMVM || "");
    setDisplayOrder(dept.displayOrder);
    setIsActive(dept.isActive);
    setFormError(null);
    setDeactivationWarning(null);
    setIsModalOpen(true);
  };

  // Check deactivation warning dynamically
  useEffect(() => {
    if (editingDept && !isActive && editingDept.isActive) {
      // User is deactivating an currently active department. Check active doctors.
      async function checkDoctors() {
        const hasDocs = await hasActiveDoctors(editingDept!.id);
        if (hasDocs) {
          setDeactivationWarning(
            "Warning: This department still has active doctors. Deactivating it will prevent these doctors from being scheduled by staff."
          );
        } else {
          setDeactivationWarning(null);
        }
      }
      checkDoctors();
    } else {
      setDeactivationWarning(null);
    }
  }, [isActive, editingDept]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    if (!nameEnglish) {
      setFormError("Please fill in the department name.");
      setSaving(false);
      return;
    }

    try {
      // Check duplicate name
      const isDuplicate = await checkDepartmentNameDuplicate(
        nameEnglish,
        editingDept ? editingDept.id : undefined
      );

      if (isDuplicate) {
        setFormError("A department with this English name already exists.");
        setSaving(false);
        return;
      }

      await saveDepartment(editingDept ? editingDept.id : "", {
        nameEnglish,
        nameMalayalamUnicode: nameEnglish,
        nameMalayalamMVM,
        displayOrder,
        isActive,
      });

      setIsModalOpen(false);
      await loadDepartments();
    } catch (error) {
      console.error("Error saving department:", error);
      setFormError("Failed to save department. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Filter list
  const filteredDepartments = departments.filter(
    (d) =>
      d.nameEnglish.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Manage Departments</h2>
          <p className="text-xs text-slate-500 mt-0.5">Edit clinic directories and print styles</p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Add Department</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by department name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm bg-white placeholder:text-slate-400 h-11"
        />
      </div>

      {/* Grid / List of Departments */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-16 flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold mt-1">Loading clinic directories...</span>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3.5 rounded-full bg-teal-50/40 text-teal-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-slate-800 text-sm">No Departments Found</h4>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Try adjusting your search query or add a new department to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredDepartments.map((dept) => {
            const hasMVM = Boolean(dept.nameMalayalamMVM);
            return (
              <div
                key={dept.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{dept.nameEnglish}</span>
                    <span className="text-[9px] font-semibold text-slate-400">Order: {dept.displayOrder}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        dept.isActive
                          ? "bg-teal-50 text-teal-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {dept.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 mt-1 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[10px] uppercase text-slate-400">MVM (Malayalam Preview):</span>
                      {hasMVM ? (
                        <span className="text-slate-800 bg-teal-50/40 px-2 py-0.5 rounded text-sm leading-none border border-teal-100/30" style={{ fontFamily: "MVMAthira-Bold" }}>
                          {dept.nameMalayalamMVM}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>MVM Missing</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(dept)}
                  className="p-2.5 rounded-xl border border-slate-100 text-slate-650 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingDept ? "Edit Department" : "Add Department"}
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

              {/* Deactivation Safeguard Warning */}
              {deactivationWarning && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-700 flex items-start gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                  <span>{deactivationWarning}</span>
                </div>
              )}

              {/* Department Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nameEng" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Department Name (Malayalam Unicode)
                </label>
                <input
                  id="nameEng"
                  type="text"
                  placeholder="e.g. ജനറൽ ഒ.പി"
                  value={nameEnglish}
                  onChange={(e) => setNameEnglish(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                  required
                />
              </div>

              {/* Malayalam MVM */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="nameMalMvm" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Malayalam MVM Value (Optional)
                  </label>
                  {!nameMalayalamMVM && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded uppercase tracking-wider">
                      Missing
                    </span>
                  )}
                </div>
                <input
                  id="nameMalMvm"
                  type="text"
                  placeholder="e.g. PÈW saUnkn³"
                  value={nameMalayalamMVM}
                  onChange={(e) => setNameMalayalamMVM(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11 font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  This conversion text is used for poster layout print rendering in Phase 3.
                </span>
              </div>

              {/* Display Order & Active Toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="order" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Display Order
                  </label>
                  <input
                    id="order"
                    type="number"
                    min="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-900 bg-white h-11"
                    required
                  />
                </div>

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
              </div>

              {/* Actions */}
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
                    "Save Department"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
