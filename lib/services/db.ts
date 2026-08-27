import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Department {
  id: string;
  nameEnglish: string;
  nameMalayalamUnicode: string;
  nameMalayalamMVM?: string; // Phase 2: MVM conversion string
  displayOrder: number;
  isActive: boolean;
  aliases?: string[]; // Phase 4: aliases for bulk schedule import
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Doctor {
  id: string;
  departmentId: string;
  nameEnglish: string;
  nameMalayalamUnicode: string;
  nameMalayalamMVM?: string; // Phase 2: MVM Name
  qualificationEnglish: string;
  qualificationMalayalamUnicode: string;
  qualificationMalayalamMVM?: string; // Phase 2: MVM Qualification
  isActive: boolean;
  aliases?: string[]; // Phase 4: aliases for bulk schedule import
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ScheduleItem {
  id: string;
  doctorId: string | null;
  departmentId: string;
  startTime: string;
  endTime: string;
  displayOrder: number;
  itemType: "doctor" | "fixed_service";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // UI helper fields (joined on demand)
  doctorNameEnglish?: string;
  doctorQualificationEnglish?: string;
  doctorNameMalayalamUnicode?: string;
  doctorNameMalayalamMVM?: string;
  doctorQualificationMalayalamUnicode?: string;
  doctorQualificationMalayalamMVM?: string;
  departmentNameEnglish?: string;
  departmentNameMalayalamUnicode?: string;
  departmentNameMalayalamMVM?: string;
}

export interface PosterRequest {
  date: string; // YYYY-MM-DD
  status: "draft" | "submitted" | "processing" | "completed";
  createdBy: string;
  doctorCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  showPhysiotherapy?: boolean;
  scheduleItems?: ScheduleItem[];
  inputMethod?: "manual" | "bulk_import"; // Phase 4 metadata
  generatedPoster?: {
    storagePath: string;
    downloadUrl: string;
    version: number;
    generatedByUid: string;
    generatedAt: Timestamp;
  };
  posterVersions?: Array<{
    version: number;
    storagePath: string;
    downloadUrl: string;
    generatedByUid: string;
    generatedAt: Timestamp;
  }>;
  // UI helper field
  createdByName?: string;
}

export interface StaffUserProfile {
  uid: string;
  name: string;
  email: string;
  role: "staff" | "designer";
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 1. Fetch active departments ordered by displayOrder (Staff Portal)
export async function fetchActiveDepartments(): Promise<Department[]> {
  const q = query(
    collection(db, "departments"),
    where("isActive", "==", true)
  );
  const querySnapshot = await getDocs(q);
  const depts = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Department[];

  // Sort in memory to avoid requiring a composite Firestore index
  return depts.sort((a, b) => a.displayOrder - b.displayOrder);
}

// 2. Fetch all departments (Designer Portal)
export async function fetchAllDepartments(): Promise<Department[]> {
  const q = query(
    collection(db, "departments")
  );
  const querySnapshot = await getDocs(q);
  const depts = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Department[];

  // Sort in memory to avoid requiring a composite Firestore index
  return depts.sort((a, b) => a.displayOrder - b.displayOrder);
}

// 3. Fetch active doctors, optionally filtered by department (Staff Portal)
export async function fetchActiveDoctors(departmentId?: string): Promise<Doctor[]> {
  let q = query(
    collection(db, "doctors"),
    where("isActive", "==", true)
  );
  if (departmentId) {
    q = query(
      collection(db, "doctors"),
      where("isActive", "==", true),
      where("departmentId", "==", departmentId)
    );
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Doctor[];
}

// 4. Fetch all doctors (Designer Portal)
export async function fetchAllDoctors(departmentId?: string): Promise<Doctor[]> {
  let q = query(collection(db, "doctors"));
  if (departmentId) {
    q = query(
      collection(db, "doctors"),
      where("departmentId", "==", departmentId)
    );
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Doctor[];
}

// 5. Save/Update department
export async function saveDepartment(
  id: string,
  data: Omit<Department, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const finalId = id || `dept_${Date.now()}`;
  const docRef = doc(db, "departments", finalId);
  const docSnap = await getDoc(docRef);
  const isExisting = docSnap.exists();

  await setDoc(docRef, {
    nameEnglish: data.nameEnglish.trim(),
    nameMalayalamUnicode: data.nameMalayalamUnicode.trim(),
    nameMalayalamMVM: (data.nameMalayalamMVM || "").trim(),
    displayOrder: Number(data.displayOrder),
    isActive: Boolean(data.isActive),
    aliases: data.aliases || [],
    updatedAt: serverTimestamp(),
    ...(isExisting ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });

  return finalId;
}

// 6. Save/Update doctor
export async function saveDoctor(
  id: string,
  data: Omit<Doctor, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const finalId = id || `doc_${Date.now()}`;
  const docRef = doc(db, "doctors", finalId);
  const docSnap = await getDoc(docRef);
  const isExisting = docSnap.exists();

  await setDoc(docRef, {
    departmentId: data.departmentId,
    nameEnglish: data.nameEnglish.trim(),
    nameMalayalamUnicode: data.nameMalayalamUnicode.trim(),
    nameMalayalamMVM: (data.nameMalayalamMVM || "").trim(),
    qualificationEnglish: data.qualificationEnglish.trim(),
    qualificationMalayalamUnicode: data.qualificationMalayalamUnicode.trim(),
    qualificationMalayalamMVM: (data.qualificationMalayalamMVM || "").trim(),
    isActive: Boolean(data.isActive),
    aliases: data.aliases || [],
    updatedAt: serverTimestamp(),
    ...(isExisting ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });

  return finalId;
}

// 7. Check if a department contains active doctors
export async function hasActiveDoctors(departmentId: string): Promise<boolean> {
  const q = query(
    collection(db, "doctors"),
    where("departmentId", "==", departmentId),
    where("isActive", "==", true)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.size > 0;
}

// 8. Prevent duplicate department names
export async function checkDepartmentNameDuplicate(
  nameEnglish: string,
  excludeId?: string
): Promise<boolean> {
  const q = query(
    collection(db, "departments"),
    where("nameEnglish", "==", nameEnglish.trim())
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return false;
  
  if (excludeId) {
    return querySnapshot.docs.some((doc) => doc.id !== excludeId);
  }
  return true;
}

// 9. Fetch staff users (excluding designers for security, or fetch all users)
export async function fetchStaffUsers(): Promise<StaffUserProfile[]> {
  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  const users = querySnapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  })) as StaffUserProfile[];

  return users.filter((u) => u.name !== "Temp Seed Admin" && u.uid !== "temp_seed_admin");
}

// 10. Update user active status
export async function updateUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
  const docRef = doc(db, "users", userId);
  await updateDoc(docRef, {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

// 11. Fetch a single poster request and its subcollection scheduleItems
export async function fetchPosterRequestWithItems(
  dateString: string
): Promise<PosterRequest | null> {
  const docRef = doc(db, "posterRequests", dateString);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const requestData = docSnap.data() as Omit<PosterRequest, "scheduleItems">;
  
  // Fetch subcollection scheduleItems
  const itemsSnap = await getDocs(
    query(
      collection(db, "posterRequests", dateString, "scheduleItems"),
      orderBy("displayOrder", "asc")
    )
  );
  
  const scheduleItems = itemsSnap.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  })) as ScheduleItem[];

  return {
    ...requestData,
    scheduleItems,
  };
}

// 12. Save/Update poster request and schedule items in a transaction batch
export async function savePosterRequest(
  dateString: string,
  userId: string,
  status: "draft" | "submitted" | "processing" | "completed",
  scheduleItems: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">[],
  showPhysiotherapy?: boolean,
  inputMethod?: "manual" | "bulk_import"
): Promise<void> {
  const batch = writeBatch(db);
  const requestRef = doc(db, "posterRequests", dateString);
  
  // Check if request already exists to retain its createdAt
  const requestSnap = await getDoc(requestRef);
  const isExisting = requestSnap.exists();
  
  batch.set(requestRef, {
    date: dateString,
    status,
    createdBy: userId,
    updatedAt: serverTimestamp(),
    doctorCount: scheduleItems.filter((i) => i.itemType === "doctor").length,
    showPhysiotherapy: showPhysiotherapy !== undefined ? showPhysiotherapy : true,
    inputMethod: inputMethod || "manual",
    ...(isExisting ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });

  // Delete all existing schedule items first to perform a clean overwrite
  if (isExisting) {
    const existingItemsSnap = await getDocs(
      collection(db, "posterRequests", dateString, "scheduleItems")
    );
    existingItemsSnap.docs.forEach((itemDoc) => {
      batch.delete(itemDoc.ref);
    });
  }

  // Insert new schedule items
  scheduleItems.forEach((item, index) => {
    const itemRef = doc(collection(db, "posterRequests", dateString, "scheduleItems"));
    batch.set(itemRef, {
      ...item,
      displayOrder: index, // maintain current reordered position
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

// 13. Fetch poster requests history (staff view, or all history)
export async function fetchPosterRequestsHistory(): Promise<Omit<PosterRequest, "scheduleItems">[]> {
  const q = query(
    collection(db, "posterRequests"),
    orderBy("date", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => doc.data()) as Omit<PosterRequest, "scheduleItems">[];
}

// 14. Fetch all poster requests (Designer Portal) joined with user names
export async function fetchAllPosterRequests(): Promise<Omit<PosterRequest, "scheduleItems">[]> {
  const q = query(
    collection(db, "posterRequests"),
    orderBy("date", "desc")
  );
  const querySnapshot = await getDocs(q);
  const requests = querySnapshot.docs.map((doc) => doc.data()) as Omit<PosterRequest, "scheduleItems">[];
  
  // Fetch user profiles to join creator names
  const usersMap: { [uid: string]: string } = {};
  const usersSnap = await getDocs(collection(db, "users"));
  usersSnap.docs.forEach((udoc) => {
    usersMap[udoc.id] = udoc.data().name || "Unknown Staff";
  });

  return requests.map((req) => {
    let name = usersMap[req.createdBy] || "Unknown Staff";
    if (name === "Temp Seed Admin") {
      name = "System Admin";
    }
    return {
      ...req,
      createdByName: name,
    };
  });
}

// 15. Update poster request status
export async function updatePosterRequestStatus(
  dateString: string,
  status: "draft" | "submitted" | "processing" | "completed"
): Promise<void> {
  const docRef = doc(db, "posterRequests", dateString);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

// 17. Save generated poster metadata to poster request
export async function saveGeneratedPosterMetadata(
  dateString: string,
  storagePath: string,
  downloadUrl: string,
  version: number,
  generatedByUid: string
): Promise<void> {
  const docRef = doc(db, "posterRequests", dateString);
  await updateDoc(docRef, {
    generatedPoster: {
      storagePath,
      downloadUrl,
      version,
      generatedByUid,
      generatedAt: serverTimestamp(),
    },
    posterVersions: arrayUnion({
      version,
      storagePath,
      downloadUrl,
      generatedByUid,
      generatedAt: Timestamp.now(),
    }),
    updatedAt: serverTimestamp(),
  });
}

// 16. Seed database with dummy departments and doctors (updated with MVM fields for testing)
export async function seedDatabase(): Promise<boolean> {
  try {
    const batch = writeBatch(db);

    // List of departments to seed
    const depts = [
      { id: "dept_general_medicine", nameEnglish: "General Medicine", nameMalayalamUnicode: "ജനറൽ മെഡിസിൻ", nameMalayalamMVM: "PÈW¬ saUnkn³", displayOrder: 1, isActive: true, aliases: [] },
      { id: "dept_cardiology", nameEnglish: "Cardiology", nameMalayalamUnicode: "കാർഡിയോളജി", nameMalayalamMVM: "ImÀUntbmfPn", displayOrder: 2, isActive: true, aliases: [] },
      { id: "dept_dental", nameEnglish: "Dental", nameMalayalamUnicode: "ദന്തവിഭാഗം", nameMalayalamMVM: "Z´hn`mKw", displayOrder: 3, isActive: true, aliases: ["ദന്തരോഗ വിഭാഗം", "ദന്ത വിഭാഗം"] },
      { id: "dept_ent", nameEnglish: "ENT", nameMalayalamUnicode: "ഇ.എൻ.ടി വിഭാഗം", nameMalayalamMVM: "", displayOrder: 4, isActive: true, aliases: [] },
      { id: "dept_orthopaedics", nameEnglish: "Orthopaedics", nameMalayalamUnicode: "ഓർത്തോപീഡിക്സ്", nameMalayalamMVM: "t\mÀt¯m]oUnIvkv", displayOrder: 5, isActive: true, aliases: [] },
      { id: "dept_general_op", nameEnglish: "General OP", nameMalayalamUnicode: "ജനറൽ ഒ.പി", nameMalayalamMVM: "PÈW¬ OP", displayOrder: 6, isActive: true, aliases: ["ജനറൽ OP", "ജനറൽ ഒ പി", "ജനറൽ ഒ.പി."] },
      { id: "dept_paediatric_dentistry", nameEnglish: "Paediatric Dentistry", nameMalayalamUnicode: "ശിശു ദന്ത ചികിത്സ വിഭാഗം", nameMalayalamMVM: "inip Z´ NnInÕm hn`mKw", displayOrder: 7, isActive: true, aliases: ["ശിശുദന്തചികിത്സാവിഭാഗം"] },
      { id: "dept_orthodontics", nameEnglish: "Orthodontics", nameMalayalamUnicode: "ദന്ത ക്രമീകരണ വിഭാഗം", nameMalayalamMVM: "Z´ {IaoIcW hn`mKw", displayOrder: 8, isActive: true, aliases: ["ദന്തക്രമീകരണവിഭാഗം"] },
      { id: "dept_physiotherapy", nameEnglish: "Physiotherapy & Rehabilitation", nameMalayalamUnicode: "ഫിസിയോതെറാപ്പി & റീഹാബിലിറ്റേഷൻ", nameMalayalamMVM: "^nknbmt¯d¸n & dolm_nentej³", displayOrder: 99, isActive: true, aliases: [] },
    ];

    // Seed departments
    depts.forEach((d) => {
      const docRef = doc(db, "departments", d.id);
      batch.set(docRef, {
        nameEnglish: d.nameEnglish,
        nameMalayalamUnicode: d.nameMalayalamUnicode,
        nameMalayalamMVM: d.nameMalayalamMVM,
        displayOrder: d.displayOrder,
        isActive: d.isActive,
        aliases: d.aliases,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    // List of doctors to seed
    const docs = [
      // General Medicine (MVM Ready)
      { 
        id: "doc_rahul_krishnan", 
        departmentId: "dept_general_medicine", 
        nameEnglish: "Dr. Rahul Krishnan", 
        nameMalayalamUnicode: "ഡോ. രാഹുൽ കൃഷ്ണൻ", 
        nameMalayalamMVM: "tUm. cmlp¬ IrjvW³",
        qualificationEnglish: "MD (General Medicine)", 
        qualificationMalayalamUnicode: "എം.ഡി (ജനറൽ മെഡിസിൻ)", 
        qualificationMalayalamMVM: "Fw.Un. (PÈW¬ saUnkn³)",
        isActive: true,
        aliases: []
      },
      // General Medicine (MVM Missing)
      { 
        id: "doc_anjali_menon", 
        departmentId: "dept_general_medicine", 
        nameEnglish: "Dr. Anjali Menon", 
        nameMalayalamUnicode: "ഡോ. അഞ്ജലി മേനോൻ", 
        nameMalayalamMVM: "", // Name MVM missing
        qualificationEnglish: "MBBS, DNB", 
        qualificationMalayalamUnicode: "എം.ബി.ബി.എസ്, ഡി.എൻ.ബി", 
        qualificationMalayalamMVM: "", // Qualification MVM missing
        isActive: true,
        aliases: []
      },
      
      // Cardiology (MVM Ready)
      { 
        id: "doc_thomas_mathew", 
        departmentId: "dept_cardiology", 
        nameEnglish: "Dr. Thomas Mathew", 
        nameMalayalamUnicode: "ഡോ. തോമസ് മാത്യു", 
        nameMalayalamMVM: "tUm. tXmwk v amXyq",
        qualificationEnglish: "MD, DM (Cardiology)", 
        qualificationMalayalamUnicode: "എം.ഡി, ഡി.എം (കാർഡിയോളജി)", 
        qualificationMalayalamMVM: "Fw.Un, Un.Fw (ImÀUntbmfPn)",
        isActive: true,
        aliases: []
      },
      { 
        id: "doc_priya_nair", 
        departmentId: "dept_cardiology", 
        nameEnglish: "Dr. Priya Nair", 
        nameMalayalamUnicode: "ഡോ. പ്രിയ നായർ", 
        nameMalayalamMVM: "tUm. ]n vb \mbÀ",
        qualificationEnglish: "MD, DNB (Cardiology)", 
        qualificationMalayalamUnicode: "എം.ഡി, ഡി.എൻ.ബി (കാർഡിയോളജി)", 
        qualificationMalayalamMVM: "Fw.Un, UnF³_n (ImÀUntbmfPn)",
        isActive: true,
        aliases: []
      },

      // Dental (MVM Ready)
      { 
        id: "doc_manoj_joseph", 
        departmentId: "dept_dental", 
        nameEnglish: "Dr. Manoj Joseph", 
        nameMalayalamUnicode: "ഡോ. മനോജ് ജോസഫ്", 
        nameMalayalamMVM: "tUm. at\mPv tPmk^v",
        qualificationEnglish: "MDS (Orthodontics)", 
        qualificationMalayalamUnicode: "എം.ഡി.എസ് (ഓർത്തോഡോൺടിക്സ്)", 
        qualificationMalayalamMVM: "Fw.Un.Fkv (t\mÀt¯mUfâIvkv)",
        isActive: true,
        aliases: []
      },
      { 
        id: "doc_swapna_roy", 
        departmentId: "dept_dental", 
        nameEnglish: "Dr. Swapna Roy", 
        nameMalayalamUnicode: "ഡോ. സ്വപ്ന റോയ്", 
        nameMalayalamMVM: "", // missing
        qualificationEnglish: "BDS", 
        qualificationMalayalamUnicode: "ബി.ഡി.എസ്", 
        qualificationMalayalamMVM: "", // missing
        isActive: true,
        aliases: []
      },

      // ENT (MVM Ready)
      { 
        id: "doc_harish_kumar", 
        departmentId: "dept_ent", 
        nameEnglish: "Dr. Harish Kumar", 
        nameMalayalamUnicode: "ഡോ. ഹരീഷ് കുമാർ", 
        nameMalayalamMVM: "tUm. lcojv I amÀ",
        qualificationEnglish: "MS, DLO (ENT)", 
        qualificationMalayalamUnicode: "എം.എസ്, ഡി.എൽ.ഒ (ഇ.എൻ.ടി)", 
        qualificationMalayalamMVM: "Fw.Fkv, Un.F¬.H (C.F³.Sn)",
        isActive: true,
        aliases: []
      },

      // Orthopaedics (MVM Ready)
      { 
        id: "doc_vivek_chandran", 
        departmentId: "dept_orthopaedics", 
        nameEnglish: "Dr. Vivek Chandran", 
        nameMalayalamUnicode: "ഡോ. വിവേക് ചന്ദ്രൻ", 
        nameMalayalamMVM: "tUm. hnthi v N{µ³",
        qualificationEnglish: "MS (Ortho)", 
        qualificationMalayalamUnicode: "എം.എസ് (ഓർത്തോ)", 
        qualificationMalayalamMVM: "Fw.Fkv (HmtÀ¯m)",
        isActive: true,
        aliases: []
      },
      // Inactive doctor for validation testing
      { 
        id: "doc_sandeep_pillai", 
        departmentId: "dept_orthopaedics", 
        nameEnglish: "Dr. Sandeep Pillai (INACTIVE)", 
        nameMalayalamUnicode: "ഡോ. സന്ദീപ് പിള്ള", 
        nameMalayalamMVM: "",
        qualificationEnglish: "MS, MCh (Ortho)", 
        qualificationMalayalamUnicode: "എം.എസ്, എം.സി.എച്ച് (ഓർത്തോ)", 
        qualificationMalayalamMVM: "",
        isActive: false,
        aliases: []
      },

      // General OP (New for Bulk Schedule Import testing)
      { 
        id: "doc_mabel_john", 
        departmentId: "dept_general_op", 
        nameEnglish: "Dr. Mabel John", 
        nameMalayalamUnicode: "ഡോ. മേബിൾ ജോൺ", 
        nameMalayalamMVM: "tUm. ta_nÄ tPm¬",
        qualificationEnglish: "MBBS", 
        qualificationMalayalamUnicode: "എം.ബി.ബി.എസ്", 
        qualificationMalayalamMVM: "Fw._n._n.Fkv",
        isActive: true,
        aliases: ["മേബിൾ ജോൺ", "മേബിൾ"]
      },
      { 
        id: "doc_sujeesh_b_raj", 
        departmentId: "dept_general_op", 
        nameEnglish: "Dr. Sujeesh B Raj", 
        nameMalayalamUnicode: "ഡോ. സുജീഷ് ബി രാജ്", 
        nameMalayalamMVM: "tUm. kpPojv _n cmPv",
        qualificationEnglish: "MBBS", 
        qualificationMalayalamUnicode: "എം.ബി.ബി.എസ്", 
        qualificationMalayalamMVM: "Fw._n._n.Fkv",
        isActive: true,
        aliases: ["സുജീഷ് ബി രാജ്", "സുജീഷ്"]
      },

      // Dental (Additional New for Bulk Schedule Import testing)
      { 
        id: "doc_muhammad_sajid", 
        departmentId: "dept_dental", 
        nameEnglish: "Dr. Muhammad Sajid", 
        nameMalayalamUnicode: "ഡോ. മുഹമ്മദ് സാജിദ്", 
        nameMalayalamMVM: "tUm. apl½Zv kmpPnZv",
        qualificationEnglish: "BDS (Dental Surgeon)", 
        qualificationMalayalamUnicode: "ബി.ഡി.എസ് (ഡെന്റൽ സർജൻ)", 
        qualificationMalayalamMVM: "_n.Un.Fkv",
        isActive: true,
        aliases: ["മുഹമ്മദ് സാജിദ്", "സാജിദ്"]
      },

      // Paediatric Dentistry (New for Bulk Schedule Import testing)
      { 
        id: "doc_aparna", 
        departmentId: "dept_paediatric_dentistry", 
        nameEnglish: "Dr. Aparna", 
        nameMalayalamUnicode: "ഡോ. അപർണ", 
        nameMalayalamMVM: "tUm. A]À®",
        qualificationEnglish: "BDS, MDS", 
        qualificationMalayalamUnicode: "ബി.ഡി.എസ്, എം.ഡി.എസ്", 
        qualificationMalayalamMVM: "_n.Un.Fkv, Fw.Un.Fkv",
        isActive: true,
        aliases: ["അപർണ"]
      },

      // Orthodontics (New for Bulk Schedule Import testing)
      { 
        id: "doc_moosa", 
        departmentId: "dept_orthodontics", 
        nameEnglish: "Dr. Moosa", 
        nameMalayalamUnicode: "ഡോ. മൂസ", 
        nameMalayalamMVM: "tUm. aqkm",
        qualificationEnglish: "BDS, MDS", 
        qualificationMalayalamUnicode: "ബി.ഡി.എസ്, എം.ഡി.എസ്", 
        qualificationMalayalamMVM: "_n.Un.Fkv, Fw.Un.Fkv",
        isActive: true,
        aliases: ["മൂസ"]
      },
    ];

    // Seed doctors
    docs.forEach((docData) => {
      const docRef = doc(db, "doctors", docData.id);
      batch.set(docRef, {
        departmentId: docData.departmentId,
        nameEnglish: docData.nameEnglish,
        nameMalayalamUnicode: docData.nameMalayalamUnicode,
        nameMalayalamMVM: docData.nameMalayalamMVM,
        qualificationEnglish: docData.qualificationEnglish,
        qualificationMalayalamUnicode: docData.qualificationMalayalamUnicode,
        qualificationMalayalamMVM: docData.qualificationMalayalamMVM,
        isActive: docData.isActive,
        aliases: docData.aliases,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Failed to seed database:", error);
    return false;
  }
}

// 15. Clear all doctors and departments from the database
export async function clearDoctorsAndDepartments(): Promise<void> {
  const batch = writeBatch(db);

  const docsSnapshot = await getDocs(collection(db, "doctors"));
  docsSnapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  const deptsSnapshot = await getDocs(collection(db, "departments"));
  deptsSnapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  await batch.commit();
}

// 16. Save date position settings for the poster template
export async function savePosterSettings(settings: { datePositionX: number, datePositionY: number }): Promise<void> {
  const docRef = doc(db, "settings", "poster");
  await setDoc(docRef, settings, { merge: true });
}

// 17. Fetch date position settings for the poster template
export async function fetchPosterSettings(): Promise<{ datePositionX: number, datePositionY: number }> {
  const docRef = doc(db, "settings", "poster");
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      datePositionX: typeof data.datePositionX === "number" ? data.datePositionX : 80,
      datePositionY: typeof data.datePositionY === "number" ? data.datePositionY : 80,
    };
  }
  return { datePositionX: 80, datePositionY: 80 };
}

