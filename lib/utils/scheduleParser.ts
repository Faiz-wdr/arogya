import { Department, Doctor } from "@/lib/services/db";

export interface ParsedResultItem {
  department: Department | null;
  doctor: Doctor | null;
  doctorNameUnicode?: string; // custom name for unknown doctors
  isUnknownDoctor?: boolean;
  isUnrecognized?: boolean; // unrecognized line flag
  qualification: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  status: "Matched" | "Needs Review" | "Not Found";
  notes?: string;
  originalText: string;
}

// Normalize text: lowercase, remove punctuation, collapse/remove all whitespace
export function normalizeForMatching(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[.,\-\(\)\/\\]/g, "") // remove punctuation
    .replace(/\s+/g, "")           // remove all spaces to handle "ഒ പി" vs "ഒപി"
    .trim();
}

// Normalize doctor names by removing "ഡോ" / "dr" prefixes
export function normalizeDoctorName(text: string): string {
  let normalized = normalizeForMatching(text);
  // Remove Malayalam and English doctor titles/prefixes
  normalized = normalized.replace(/^(ഡോ|dr)/, "");
  return normalized;
}

// Levenshtein distance helper
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// String similarity based on Levenshtein distance
export function getSimilarity(a: string, b: string): number {
  const distance = getLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

// Extract date from text
export function extractDate(text: string): string | null {
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmRef = /\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b/;
  const dmMatch = text.match(dmRef);
  if (dmMatch) {
    const d = parseInt(dmMatch[1], 10);
    const m = parseInt(dmMatch[2], 10);
    const y = parseInt(dmMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // Try YYYY-MM-DD or YYYY/MM/DD
  const ymRef = /\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b/;
  const ymMatch = text.match(ymRef);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    const d = parseInt(ymMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

// Find period keyword closest to the left of the index
function findPeriodBefore(text: string, index: number): string | null {
  const substring = text.substring(0, index);
  const keywords = ["രാവിലെ", "ഉച്ചയ്ക്ക്", "വൈകുന്നേരം", "രാത്രി"];
  let closestKeyword: string | null = null;
  let closestIndex = -1;

  for (const kw of keywords) {
    const kwIdx = substring.lastIndexOf(kw);
    if (kwIdx !== -1 && kwIdx > closestIndex) {
      closestIndex = kwIdx;
      closestKeyword = kw;
    }
  }

  return closestKeyword;
}

// Convert hour + minute + period to 24h format
function resolveTime(hour: number, minute: number, period: string | null): { time24: string; error?: string } {
  if (!period) {
    return { time24: "", error: "Missing period" };
  }

  let resolvedHour = hour;
  if (period === "രാവിലെ") {
    if (hour === 12) {
      resolvedHour = 0; // 12 AM
    } else if (hour > 12) {
      return { time24: "", error: `Invalid morning hour: ${hour}` };
    }
  } else if (period === "ഉച്ചയ്ക്ക്" || period === "വൈകുന്നേരം") {
    if (hour < 12) {
      resolvedHour = hour + 12; // PM
    } else if (hour === 12) {
      resolvedHour = 12; // 12 PM
    } else {
      return { time24: "", error: `Invalid PM hour: ${hour}` };
    }
  } else if (period === "രാത്രി") {
    if (hour >= 7 && hour < 12) {
      resolvedHour = hour + 12; // 7 PM - 11 PM
    } else if (hour === 12) {
      resolvedHour = 0; // 12 AM
    } else if (hour < 7) {
      resolvedHour = hour; // 1 AM - 6 AM
    } else {
      return { time24: "", error: `Invalid night hour: ${hour}` };
    }
  } else {
    return { time24: "", error: `Unknown period: ${period}` };
  }

  const hh = String(resolvedHour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return { time24: `${hh}:${mm}` };
}

// Parse time expression to HH:mm start/end and crossesMidnight
export function parseTime(timeStr: string): { startTime: string; endTime: string; crossesMidnight: boolean; error?: string } | null {
  const timeRegex = /(\d{1,2})(?:\s*:\s*(\d{2}))?/g;
  const matches: { hour: number; minute: number; index: number; text: string }[] = [];
  
  let match;
  while ((match = timeRegex.exec(timeStr)) !== null) {
    matches.push({
      hour: parseInt(match[1], 10),
      minute: match[2] ? parseInt(match[2], 10) : 0,
      index: match.index,
      text: match[0],
    });
  }

  if (matches.length !== 2) {
    return null; // Ambiguous or invalid: needs to have exactly start and end time
  }

  const m1 = matches[0];
  const m2 = matches[1];

  const p1 = findPeriodBefore(timeStr, m1.index);
  let p2 = findPeriodBefore(timeStr, m2.index);

  // If second time doesn't have its own period, check if there's a period keyword in between.
  // If not, inherit period from first time.
  const segmentBetween = timeStr.substring(m1.index + m1.text.length, m2.index);
  const keywords = ["രാവിലെ", "ഉച്ചയ്ക്ക്", "വൈകുന്നേരം", "രാത്രി"];
  const hasKeywordInBetween = keywords.some(k => segmentBetween.includes(k));
  if (!p2 || !hasKeywordInBetween) {
    p2 = p1;
  }

  let r1 = resolveTime(m1.hour, m1.minute, p1);
  let r2 = resolveTime(m2.hour, m2.minute, p2);

  let err = r1.error || r2.error;
  let startTime = r1.time24;
  let endTime = r2.time24;

  if (startTime && endTime) {
    const sVal = m1.hour * 60 + m1.minute;
    const eVal = m2.hour * 60 + m2.minute;

    // Handle "10 മുതൽ 1 வரை" type of AM -> PM automatic correction
    // If start is morning (AM) and end inherits morning (AM), but end time hour is less than start time hour
    if (p1 === "രാവിലെ" && p2 === p1 && m2.hour < m1.hour) {
      // Re-resolve end time as PM (ഉച്ചയ്ക്ക്/വൈകുന്നേരം)
      const correctedR2 = resolveTime(m2.hour, m2.minute, "ഉച്ചയ്ക്ക്");
      if (!correctedR2.error) {
        endTime = correctedR2.time24;
        p2 = "ഉച്ചയ്ക്ക്";
        err = (err ? err + "; " : "") + "Ambiguous time resolved to PM";
      }
    }
  }

  const crossesMidnight = startTime && endTime ? startTime >= endTime : false;

  return {
    startTime,
    endTime,
    crossesMidnight,
    error: err,
  };
}

// Match line against department master data
export function matchDepartment(
  line: string,
  departments: Department[]
): { department: Department | null; confident: boolean } {
  const normLine = normalizeForMatching(line);
  if (!normLine) return { department: null, confident: false };

  // 1. Exact match on English Name
  let found = departments.find(d => normalizeForMatching(d.nameEnglish) === normLine);
  if (found) return { department: found, confident: true };

  // 2. Exact match on Malayalam Name
  found = departments.find(d => normalizeForMatching(d.nameMalayalamUnicode) === normLine);
  if (found) return { department: found, confident: true };

  // 3. Exact match on aliases
  found = departments.find(d => d.aliases?.some(alias => normalizeForMatching(alias) === normLine));
  if (found) return { department: found, confident: true };

  // 4. Lightweight fuzzy matching (similarity > 0.85)
  let bestDept: Department | null = null;
  let bestScore = 0;
  for (const dept of departments) {
    const scores = [
      getSimilarity(normLine, normalizeForMatching(dept.nameEnglish)),
      getSimilarity(normLine, normalizeForMatching(dept.nameMalayalamUnicode)),
      ...(dept.aliases || []).map(alias => getSimilarity(normLine, normalizeForMatching(alias)))
    ];
    const maxScore = Math.max(...scores);
    if (maxScore > bestScore) {
      bestScore = maxScore;
      bestDept = dept;
    }
  }

  if (bestScore > 0.85 && bestDept) {
    return { department: bestDept, confident: true };
  }

  return { department: null, confident: false };
}

// Match line exactly (or by alias) against doctor master data
export function matchDoctorExact(line: string, doctors: Doctor[]): Doctor | null {
  const normLine = normalizeDoctorName(line);
  if (!normLine) return null;

  const activeDoctors = doctors.filter(doc => doc.isActive);

  // 1. Exact match on English name
  let found = activeDoctors.find(d => normalizeDoctorName(d.nameEnglish) === normLine);
  if (found) return found;

  // 2. Exact match on Malayalam name
  found = activeDoctors.find(d => normalizeDoctorName(d.nameMalayalamUnicode) === normLine);
  if (found) return found;

  // 3. Exact match on aliases
  found = activeDoctors.find(d => d.aliases?.some(alias => normalizeDoctorName(alias) === normLine));
  if (found) return found;

  return null;
}

// Check if a line is a qualification pattern
export function isQualificationLine(line: string): boolean {
  const norm = line.trim().toLowerCase();
  if (!norm) return false;
  // Match standard medical/dental degrees as standalone words or in comma/bracket contexts
  const qualPattern = /\b(mbbs|bds|bams|bhms|md|ms|mds|dnb|dm|m\.?ch|diploma|surgeon|fellowship|phd|bsc|msc)\b/i;
  return qualPattern.test(norm);
}

// Check if a line is a time expression line
export function isTimeLine(line: string): boolean {
  const keywords = ["രാവിലെ", "ഉച്ചയ്ക്ക്", "വൈകുന്നേരം", "രാത്രി", "മണി", "മുതൽ", "വരെ", "am", "pm"];
  const hasKeyword = keywords.some(kw => line.toLowerCase().includes(kw));
  const hasDigit = /\d/.test(line);
  return hasKeyword || hasDigit;
}

// Check if a line should be treated as a doctor
export function isDoctorLine(
  line: string,
  doctors: Doctor[],
  currentDepartment: Department | null,
  previousLineWasDepartment: boolean,
  isQual: boolean,
  isTime: boolean
): { isDoc: boolean; matchedDoctor: Doctor | null; isUnknown: boolean } {
  // 1. Check if it matches an existing doctor or alias in the database
  const matched = matchDoctorExact(line, doctors);
  if (matched) {
    return { isDoc: true, matchedDoctor: matched, isUnknown: false };
  }

  // 2. Check if it begins with a doctor prefix
  const trimmed = line.trim();
  const hasPrefix = trimmed.startsWith("ഡോ.") || trimmed.startsWith("ഡോ ") || trimmed.startsWith("ഡോ") ||
                    trimmed.toLowerCase().startsWith("dr.") || trimmed.toLowerCase().startsWith("dr ");
  if (hasPrefix) {
    return { isDoc: true, matchedDoctor: null, isUnknown: true };
  }

  // 3. It clearly follows a department and does not match a qualification or time pattern
  if (currentDepartment && previousLineWasDepartment && !isQual && !isTime) {
    return { isDoc: true, matchedDoctor: null, isUnknown: true };
  }

  return { isDoc: false, matchedDoctor: null, isUnknown: false };
}

// Parse entire schedule text sequentially
export function parseSchedule(
  text: string,
  departments: Department[],
  doctors: Doctor[]
): { date: string | null; items: ParsedResultItem[] } {
  const date = extractDate(text);

  // Pre-process and merge lines if time is split across lines
  const rawLines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const lines: string[] = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    let current = rawLines[i];
    
    // Skip dates
    if (extractDate(current)) {
      continue;
    }

    // Merge lines if current ends with "മുതൽ" or period and next line has "വരെ" or digit
    if (i < rawLines.length - 1 &&
        (current.includes("മുതൽ") || current.includes("രാവിലെ") || current.includes("ഉച്ചയ്ക്ക്") || current.includes("വൈകുന്നേരം") || current.includes("രാത്രി")) &&
        !current.includes("വരെ") &&
        (rawLines[i+1].includes("വരെ") || /\d/.test(rawLines[i+1]))) {
      current = current + " " + rawLines[i+1];
      i++;
    }
    lines.push(current);
  }

  let currentDept: Department | null = null;
  let currentDoctor: ParsedResultItem | null = null;
  let previousLineWasDepartment = false;
  const parsedItems: ParsedResultItem[] = [];

  for (const line of lines) {
    // 1. Check if line matches a Department
    const deptMatch = matchDepartment(line, departments);
    if (deptMatch.department) {
      if (currentDoctor) {
        parsedItems.push(currentDoctor);
      }
      currentDoctor = null;
      currentDept = deptMatch.department;
      previousLineWasDepartment = true;
      continue;
    }

    // Check classification helpers
    const isQual = isQualificationLine(line);
    const isTime = isTimeLine(line);

    // 2. Check if line matches a Qualification
    if (isQual) {
      if (currentDoctor) {
        if (currentDoctor.isUnknownDoctor) {
          currentDoctor.qualification = line.trim();
        }
        currentDoctor.originalText += "\n" + line;
      } else {
        parsedItems.push({
          department: currentDept,
          doctor: null,
          doctorNameUnicode: "",
          qualification: line.trim(),
          startTime: "",
          endTime: "",
          status: "Needs Review",
          notes: "Qualification without a doctor: " + line,
          originalText: line,
        });
      }
      previousLineWasDepartment = false;
      continue;
    }

    // 3. Check if line matches a Time expression
    if (isTime) {
      const parsedTime = parseTime(line);
      if (currentDoctor) {
        if (parsedTime) {
          currentDoctor.startTime = parsedTime.startTime;
          currentDoctor.endTime = parsedTime.endTime;
          if (parsedTime.error) {
            currentDoctor.status = "Needs Review";
            currentDoctor.notes = (currentDoctor.notes ? currentDoctor.notes + "; " : "") + parsedTime.error;
          }
        } else {
          currentDoctor.status = "Needs Review";
          currentDoctor.notes = (currentDoctor.notes ? currentDoctor.notes + "; " : "") + "Failed to parse time";
        }
        currentDoctor.originalText += "\n" + line;
      } else {
        parsedItems.push({
          department: currentDept,
          doctor: null,
          doctorNameUnicode: "",
          qualification: "",
          startTime: parsedTime ? parsedTime.startTime : "",
          endTime: parsedTime ? parsedTime.endTime : "",
          status: "Needs Review",
          notes: "Time without a doctor: " + line,
          originalText: line,
        });
      }
      previousLineWasDepartment = false;
      continue;
    }

    // 4. Try to match Doctor (known or unknown)
    const docCheck = isDoctorLine(line, doctors, currentDept, previousLineWasDepartment, isQual, isTime);
    if (docCheck.isDoc) {
      if (currentDoctor) {
        parsedItems.push(currentDoctor);
      }

      const dept: Department | null = docCheck.matchedDoctor
        ? (departments.find(d => d.id === docCheck.matchedDoctor!.departmentId) || currentDept)
        : currentDept;

      currentDoctor = docCheck.matchedDoctor
        ? {
            department: dept,
            doctor: docCheck.matchedDoctor,
            doctorNameUnicode: docCheck.matchedDoctor.nameMalayalamUnicode,
            isUnknownDoctor: false,
            qualification: docCheck.matchedDoctor.qualificationEnglish || "",
            startTime: "",
            endTime: "",
            status: "Matched",
            notes: "",
            originalText: line,
          }
        : {
            department: dept,
            doctor: null,
            doctorNameUnicode: line.trim(),
            isUnknownDoctor: true,
            qualification: "",
            startTime: "",
            endTime: "",
            status: "Needs Review",
            notes: "New / Not in Doctor Database",
            originalText: line,
          };

      if (dept) {
        currentDept = dept;
      }
      previousLineWasDepartment = false;
      continue;
    }

    // 5. Fallback/Unrecognized line
    const harmless = ["ഞായർ", "തിങ്കൾ", "ചൊവ്വ", "ബുധൻ", "വ്യാഴം", "വെള്ളി", "ശനി", "op", "ഒപി"].some(w => 
      normalizeForMatching(line).includes(normalizeForMatching(w))
    );
    if (!harmless) {
      if (currentDoctor) {
        parsedItems.push(currentDoctor);
        currentDoctor = null;
      }
      parsedItems.push({
        department: currentDept,
        doctor: null,
        doctorNameUnicode: "",
        isUnrecognized: true,
        qualification: "",
        startTime: "",
        endTime: "",
        status: "Needs Review",
        notes: "Unrecognized text: " + line,
        originalText: line,
      });
    } else {
      if (currentDoctor) {
        currentDoctor.originalText += "\n" + line;
      }
    }
    previousLineWasDepartment = false;
  }

  if (currentDoctor) {
    parsedItems.push(currentDoctor);
  }

  // Final check: if a doctor has no start/end time, set status to Needs Review
  for (const item of parsedItems) {
    if ((item.doctor || item.isUnknownDoctor) && (!item.startTime || !item.endTime)) {
      item.status = "Needs Review";
      item.notes = (item.notes ? item.notes + "; " : "") + "Missing time schedule";
    }
  }

  return { date, items: parsedItems };
}
