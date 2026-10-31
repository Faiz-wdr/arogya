/**
 * Utility to generate stamped Service Poster from /services.png using HTML5 Canvas.
 */

export interface ServicePosterCoords {
  dateX: number;
  dateY: number;
  dayY: number;
  dateFontSize: number;
  dayFontSize: number;
}

export const defaultServicePosterCoords: ServicePosterCoords = {
  dateX: 1500,
  dateY: 172,
  dayY: 245,
  dateFontSize: 76,
  dayFontSize: 76,
};

// Parse YYYY-MM-DD into a Date in local time
export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Format Date as DD/MM/YYYY
export const formatPosterDate = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Get Malayalam MVM name of the day of the week
export const getMalayalamDay = (date: Date): string => {
  const days = [
    "RmbÀ", // Sunday
    "Xn¦Ä", // Monday
    "sNmÆ", // Tuesday
    "_p[³", // Wednesday
    "hymgw", // Thursday
    "shÅn", // Friday
    "i\\n", // Saturday
  ];
  return days[date.getDay()];
};

let cachedServicesImage: HTMLImageElement | null = null;

function loadServicesImage(): Promise<HTMLImageElement> {
  if (cachedServicesImage && cachedServicesImage.complete && cachedServicesImage.naturalWidth > 0) {
    return Promise.resolve(cachedServicesImage);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = "/services.png";
    img.onload = () => {
      cachedServicesImage = img;
      resolve(img);
    };
    img.onerror = (e) => reject(new Error("Failed to load /services.png: " + e));
  });
}

/**
 * Generates high-res stamped Services Poster as a PNG Blob
 */
export async function generateServicePosterBlob(dateString: string): Promise<Blob> {
  // Ensure font is ready if document.fonts is available
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load("76px MVMAthira-Bold"),
        document.fonts.load("76px MVMAthira-Normal"),
      ]);
    } catch (e) {
      console.warn("Could not preload fonts for service poster:", e);
    }
  }

  // Read saved alignment coords and font weights from localStorage
  let coords = defaultServicePosterCoords;
  let dateFontWeight = "bold";
  let dayFontWeight = "bold";

  if (typeof window !== "undefined") {
    try {
      const savedCoords = localStorage.getItem("poster-alignment-coords");
      if (savedCoords) {
        coords = { ...defaultServicePosterCoords, ...JSON.parse(savedCoords) };
      }
      const savedWeights = localStorage.getItem("poster-alignment-weights");
      if (savedWeights) {
        const parsed = JSON.parse(savedWeights);
        if (parsed.dateFontWeight) dateFontWeight = parsed.dateFontWeight;
        if (parsed.dayFontWeight) dayFontWeight = parsed.dayFontWeight;
      }
    } catch (e) {
      console.warn("Failed reading saved service poster coords:", e);
    }
  }

  const img = await loadServicesImage();

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1728;
  canvas.height = img.naturalHeight || 2560;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create 2d canvas context for service poster");
  }

  // Draw background template
  ctx.drawImage(img, 0, 0);

  // Parse date
  const localDate = parseLocalDate(dateString);
  const dateText = formatPosterDate(localDate);
  const dayText = getMalayalamDay(localDate);

  // Text styles
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const dateFont = dateFontWeight === "bold" ? "MVMAthira-Bold" : "MVMAthira-Normal";
  ctx.font = `${coords.dateFontSize}px ${dateFont}, sans-serif`;
  ctx.fillText(dateText, coords.dateX, coords.dateY);

  const dayFont = dayFontWeight === "bold" ? "MVMAthira-Bold" : "MVMAthira-Normal";
  ctx.font = `${coords.dayFontSize}px ${dayFont}, sans-serif`;
  ctx.fillText(dayText, coords.dateX, coords.dayY);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}
