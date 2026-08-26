export function getMalayalamDateString(dateStr: string): string {
  if (!dateStr) return "";
  // dateStr is in YYYY-MM-DD format
  const dateParts = dateStr.split("-");
  if (dateParts.length !== 3) return "";
  
  const year = parseInt(dateParts[0], 10);
  const monthIdx = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  
  // Set time to noon to avoid any timezone shifts that might change the day
  const dateObj = new Date(year, monthIdx, day, 12, 0, 0);
  const weekdayIdx = dateObj.getDay();

  const malayalamMonths = [
    "ജനുവരി",
    "ഫെബ്രുവരി",
    "മാർച്ച്",
    "ഏപ്രിൽ",
    "മേയ്",
    "ജൂൺ",
    "ജൂലൈ",
    "ആഗസ്റ്റ്",
    "സെപ്റ്റംബർ",
    "ഒക്ടോബർ",
    "നവംബർ",
    "ഡിസംബർ",
  ];

  const malayalamWeekdays = [
    "ഞായർ",
    "തിങ്കൾ",
    "ചൊവ്വ",
    "ബുധൻ",
    "വ്യാഴം",
    "വെള്ളി",
    "ശനി",
  ];

  const monthName = malayalamMonths[monthIdx] || "";
  const weekdayName = malayalamWeekdays[weekdayIdx] || "";

  return `${day} ${monthName} ${year}, ${weekdayName}`;
}

export function getEnglishDateString(dateStr: string): string {
  if (!dateStr) return "";
  const dateParts = dateStr.split("-");
  if (dateParts.length !== 3) return "";
  const year = parseInt(dateParts[0], 10);
  const monthIdx = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  
  const dateObj = new Date(year, monthIdx, day, 12, 0, 0);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getMalayalamMVMDateString(dateStr: string): string {
  if (!dateStr) return "";
  const dateParts = dateStr.split("-");
  if (dateParts.length !== 3) return "";
  
  const year = parseInt(dateParts[0], 10);
  const monthIdx = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  
  const dateObj = new Date(year, monthIdx, day, 12, 0, 0);
  const weekdayIdx = dateObj.getDay();

  const mvmMonths = [
    "P\\phcn",      // January
    "s^_phcn",      // February
    "amÀ¨v",        // March
    "H{]nÂ",       // April
    "tabv",         // May
    "Pq¬",          // June
    "Pqsse",        // July
    "BKÌv",         // August
    "sk]väw_À",    // September
    "HIvtSm_À",     // October
    "\\hw_À",       // November
    "Unkw_À"        // December
  ];

  const mvmWeekdays = [
    "ªmbÀ",        // Sunday
    "Xn¦Ä",        // Monday
    "sNmÆ",        // Tuesday
    "_p[³",        // Wednesday
    "hymgw",        // Thursday
    "shÅn",        // Friday
    "i\\n"          // Saturday
  ];

  const monthMVM = mvmMonths[monthIdx] || "";
  const weekdayMVM = mvmWeekdays[weekdayIdx] || "";

  return `${day} ${monthMVM} ${year}, ${weekdayMVM}`;
}
