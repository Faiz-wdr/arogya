"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Download, Sliders, RotateCcw, Check, Save } from "lucide-react";

// Get tomorrow's date string in YYYY-MM-DD
const getTomorrowDateString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const dd = String(tomorrow.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Parse YYYY-MM-DD into a Date in local time
const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Format Date as DD/MM/YYYY
const formatPosterDate = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// Get Malayalam MVM name of the day of the week
const getMalayalamDay = (date: Date) => {
  const days = [
    "ªmbÀ",        // Sunday
    "Xn¦Ä",        // Monday
    "sNmÆ",        // Tuesday
    "_p[³",        // Wednesday
    "hymgw",        // Thursday
    "shÅn",        // Friday
    "i\\n"          // Saturday
  ];
  return days[date.getDay()];
};

export default function PosterGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [selectedDate, setSelectedDate] = useState(getTomorrowDateString());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFontLoaded, setIsFontLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dateFontWeight, setDateFontWeight] = useState("bold");
  const [dayFontWeight, setDayFontWeight] = useState("bold");
  const [isSaved, setIsSaved] = useState(false);

  // Alignment coordinates and size state (defaults calibrated for 1728 x 2560 services.png)
  const defaultCoords = {
    dateX: 1500,
    dateY: 172,
    dayY: 245,
    dateFontSize: 76,
    dayFontSize: 76,
  };

  const [coords, setCoords] = useState(defaultCoords);

  // Load settings from localStorage after mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCoords = localStorage.getItem("poster-alignment-coords");
      if (savedCoords) {
        try {
          setCoords(JSON.parse(savedCoords));
        } catch (e) {
          console.error("Failed to parse saved coords:", e);
        }
      }

      const savedWeights = localStorage.getItem("poster-alignment-weights");
      if (savedWeights) {
        try {
          const parsed = JSON.parse(savedWeights);
          if (parsed.dateFontWeight) setDateFontWeight(parsed.dateFontWeight);
          if (parsed.dayFontWeight) setDayFontWeight(parsed.dayFontWeight);
        } catch (e) {
          console.error("Failed to parse saved weights:", e);
        }
      }
    }
  }, []);

  const handleSaveSettings = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("poster-alignment-coords", JSON.stringify(coords));
      localStorage.setItem("poster-alignment-weights", JSON.stringify({ dateFontWeight, dayFontWeight }));
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    }
  };

  const resetCoords = () => {
    setCoords(defaultCoords);
    setDateFontWeight("bold");
    setDayFontWeight("bold");
    if (typeof window !== "undefined") {
      localStorage.removeItem("poster-alignment-coords");
      localStorage.removeItem("poster-alignment-weights");
    }
  };

  const handleCoordChange = (key: keyof typeof defaultCoords, value: number) => {
    setCoords((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Drawing Canvas Callback
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = "/services.png";
    img.onload = () => {
      // Set native image dimensions for high-res output
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw the original template image
      ctx.drawImage(img, 0, 0);

      // Parse and format dates
      const localDate = parseLocalDate(selectedDate);
      const dateText = formatPosterDate(localDate);
      const dayText = getMalayalamDay(localDate);

      // Configure text styles
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Draw Date
      const dateFont = dateFontWeight === "bold" ? "MVMAthira-Bold" : "MVMAthira-Normal";
      ctx.font = `${coords.dateFontSize}px ${dateFont}, sans-serif`;
      ctx.fillText(dateText, coords.dateX, coords.dateY);

      // Draw Day
      const dayFont = dayFontWeight === "bold" ? "MVMAthira-Bold" : "MVMAthira-Normal";
      ctx.font = `${coords.dayFontSize}px ${dayFont}, sans-serif`;
      ctx.fillText(dayText, coords.dateX, coords.dayY);
    };
  }, [selectedDate, coords, dateFontWeight, dayFontWeight]);

  // Load the font & trigger render
  useEffect(() => {
    Promise.all([
      document.fonts.load(`52px MVMAthira-Bold`),
      document.fonts.load(`52px MVMAthira-Normal`),
    ]).then(() => {
      setIsFontLoaded(true);
      drawCanvas();
    }).catch(() => {
      drawCanvas();
    });
  }, [drawCanvas]);

  // Trigger draw canvas on coordinate, date or weight change
  useEffect(() => {
    drawCanvas();
  }, [selectedDate, coords, dateFontWeight, dayFontWeight, drawCanvas]);

  // Download Image Handler
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDownloading(true);

    try {
      const link = document.createElement("a");
      link.download = `arogya-services-${selectedDate}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 font-sans pb-4">
      {/* Font face declaration for MVM Athira */}
      <style>{`
        @font-face {
          font-family: 'MVMAthira-Bold';
          src: url('/fonts/mvm-athira/MVMAthira-Bold.ttf') format('truetype');
        }
        @font-face {
          font-family: 'MVMAthira-Normal';
          src: url('/fonts/mvm-athira/MVMAthira-Normal.ttf') format('truetype');
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-900">Services Poster</h2>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            showAdvanced
              ? "bg-slate-50 border-slate-200 text-slate-700"
              : "border-slate-200 text-slate-500 hover:text-slate-700"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>{showAdvanced ? "Hide Controls" : "Adjust Alignment"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Date selection & Controls */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex flex-col gap-4">
            {/* Date Input */}
            <div className="flex flex-col gap-1">
              <label htmlFor="poster-date" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Poster Date
              </label>
              <input
                id="poster-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-sm text-slate-800 h-10 cursor-pointer font-medium bg-slate-50/50"
              />
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-lg py-2.5 flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer disabled:bg-teal-400 h-11"
            >
              <Download className="h-4 w-4" />
              <span>{isDownloading ? "Exporting..." : "Download PNG"}</span>
            </button>
          </div>

          {/* Alignment controls when toggled */}
          {showAdvanced && (
            <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-100/80 pb-3">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                >
                  {isSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetCoords}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Date X */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                  <span>Date Horizontal (X)</span>
                  <span>{coords.dateX}px</span>
                </div>
                <input
                  type="range"
                  min="1350"
                  max="1650"
                  value={coords.dateX}
                  onChange={(e) => handleCoordChange("dateX", Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                />
              </div>

              {/* Date Y */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                  <span>Date Vertical (Y)</span>
                  <span>{coords.dateY}px</span>
                </div>
                <input
                  type="range"
                  min="120"
                  max="280"
                  value={coords.dateY}
                  onChange={(e) => handleCoordChange("dateY", Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                />
              </div>

              {/* Day Y */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                  <span>Day Vertical (Y)</span>
                  <span>{coords.dayY}px</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="360"
                  value={coords.dayY}
                  onChange={(e) => handleCoordChange("dayY", Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                />
              </div>

              {/* Font Sizes & Weights Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date Size</label>
                  <input
                    type="number"
                    value={coords.dateFontSize}
                    onChange={(e) => handleCoordChange("dateFontSize", Number(e.target.value))}
                    className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Day Size</label>
                  <input
                    type="number"
                    value={coords.dayFontSize}
                    onChange={(e) => handleCoordChange("dayFontSize", Number(e.target.value))}
                    className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date Weight</label>
                  <select
                    value={dateFontWeight}
                    onChange={(e) => setDateFontWeight(e.target.value)}
                    className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 bg-white"
                  >
                    <option value="bold">Bold</option>
                    <option value="normal">Regular</option>
                    <option value="300">Light</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Day Weight</label>
                  <select
                    value={dayFontWeight}
                    onChange={(e) => setDayFontWeight(e.target.value)}
                    className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-600 bg-white"
                  >
                    <option value="bold">Bold</option>
                    <option value="normal">Regular</option>
                    <option value="300">Light</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: High Quality Scaled Preview */}
        <div className="lg:col-span-8 flex flex-col gap-2">
          {/* Canvas Wrapper */}
          <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-2 flex justify-center items-center overflow-hidden max-w-full">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-lg shadow-sm border border-slate-200/45 bg-white aspect-[1728/2560] max-h-[80vh] object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
