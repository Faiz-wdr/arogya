import { getMalayalamMVMDateString } from "@/lib/utils/dateUtils";

// Helper to format time (e.g. "09:00" -> "9:00 AM")
function formatTime12(time24: string): string {
  if (!time24) return "";
  const [hourStr, minStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minStr} ${ampm}`;
}

export function generatePosterHtml(
  dateString: string,
  items: any[],
  headerBase64: string,
  footerBase64: string,
  fonts: {
    shajiBold: string;
    shajiNormal: string;
    athiraBold: string;
    athiraNormal: string;
    gilmerRegular: string;
    gilmerBold: string;
    gilmerMedium: string;
    goboldUplow: string;
  },
  showPhysiotherapy?: boolean,
  datePositionX?: number,  // distance from LEFT edge (px, out of 1200)
  datePositionY?: number    // distance from TOP edge (px, out of 1600)
): string {
  const mvmDate = getMalayalamMVMDateString(dateString);

  // Extract MVM date components for calendar badge overlay
  // Format: "22 BKÌv 2026, i\\n"
  let calDayMonth = "";
  let calYearWeekday = "";
  if (mvmDate) {
    const parts = mvmDate.split(" ");
    if (parts.length >= 4) {
      calDayMonth = `${parts[0]} ${parts[1]}`; // e.g. "22 BKÌv"
      calYearWeekday = `${parts[2]} ${parts[3]}`; // e.g. "2026, i\\n"
    } else {
      calDayMonth = mvmDate;
    }
  }

  // Group items by department to match template merging
  const groupedDepts: { [key: string]: any[] } = {};
  items.forEach((item) => {
    const deptName = item.departmentNameMalayalamMVM || "Other";
    if (showPhysiotherapy === false && (deptName === "^nknbmt¯d¸n & dolm_nentej³" || deptName === "^nknbmtXncm_n & dnhm_nentedj³")) {
      return; // Skip Physiotherapy if toggled off
    }
    if (!groupedDepts[deptName]) {
      groupedDepts[deptName] = [];
    }
    groupedDepts[deptName].push(item);
  });

  const departmentKeys = Object.keys(groupedDepts);
  const rowCount = departmentKeys.length;

  // Dynamic layout scaling based on total department groups
  let deptFontSize = 28;
  let docFontSize = 34;
  let qualFontSize = 18;
  let timeFontSize = 26;
  let rowGap = "20px";
  let docRowHeight = "90px";
  let timeBadgeHeight = "60px";

  if (rowCount <= 3) {
    deptFontSize = 34;
    docFontSize = 40;
    qualFontSize = 22;
    timeFontSize = 32;
    rowGap = "36px";
    docRowHeight = "110px";
    timeBadgeHeight = "72px";
  } else if (rowCount <= 5) {
    deptFontSize = 28;
    docFontSize = 34;
    qualFontSize = 18;
    timeFontSize = 26;
    rowGap = "24px";
    docRowHeight = "95px";
    timeBadgeHeight = "60px";
  }

  // Overrides requested by user
  docFontSize = 50;
  qualFontSize = 24;
  timeFontSize = 27;

  // Render department rows
  const rowsHtml = departmentKeys
    .map((deptName) => {
      const deptItems = groupedDepts[deptName];
      const isPhysio = deptName === "^nknbmt¯d¸n & dolm_nentej³" || deptName === "^nknbmtXncm_n & dnhm_nentedj³";

      if (isPhysio) {
        // Special full-width layout for fixed Physiotherapy
        return `
          <div class="fixed-service-row">
            <div class="fixed-service-card-left">
              <span>${deptName}</span>
            </div>
            <div class="fixed-service-card-right">
              <div class="fs-badge">
                <span class="fs-line-1">FÃm Znhkhpw</span>
                <span class="fs-line-1">(ªmbÀ Ah[n)</span>
              </div>
              <span class="fs-line-2">9:00 AM - 5:00 PM</span>
            </div>
          </div>
        `;
      }

      // Normal doctor department group
      return `
        <div class="department-group">
          <!-- Left: Department Badge -->
          <div class="dept-badge-col">
            <div class="dept-badge" style="font-size: 50px;">
              <span>${deptName}</span>
            </div>
          </div>
          
          <!-- Middle: Combined White Doctors Card -->
          <div class="doctors-card">
            ${deptItems
          .map((item) => {
            const docName = item.doctorNameMalayalamMVM || "[Missing Name]";
            const qual = item.doctorQualificationEnglish || "";
            return `
                  <div class="doctor-info-row" style="min-height: ${docRowHeight}; padding: 12px 0;">
                    <div class="doctor-name" style="font-size: ${docFontSize}px;">${docName}</div>
                    ${qual ? `<div class="doctor-qual" style="font-size: ${qualFontSize}px;">${qual}</div>` : ""}
                  </div>
                `;
          })
          .join('<div class="card-divider"></div>')}
          </div>

          <!-- Right: Time Badges Column -->
          <div class="time-badges-column" style="${deptItems.length > 1 ? 'gap: 12px;' : ''}">
            ${deptItems
          .map((item) => {
            const timeStr = `${formatTime12(item.startTime)} - ${formatTime12(item.endTime)}`;
            const borderRadius = deptItems.length === 1 ? '0 24px 24px 0' : '0 20px 20px 0';
            return `
                  <div class="time-badge-wrapper">
                    <div class="time-badge" style="border-radius: ${borderRadius}; font-size: ${timeFontSize}px; padding: 10px;">
                      <span>${timeStr}</span>
                    </div>
                  </div>
                `;
          })
          .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  const headerDataUrl = `data:image/png;base64,${headerBase64}`;
  const footerDataUrl = `data:image/png;base64,${footerBase64}`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Daily Doctor Availability Poster</title>
      <style>
        @font-face {
          font-family: 'MLKVShaji-Bold';
          src: url('data:font/truetype;charset=utf-8;base64,${fonts.shajiBold}') format('truetype');
        }
        @font-face {
          font-family: 'MLKVShaji-Normal';
          src: url('data:font/truetype;charset=utf-8;base64,${fonts.shajiNormal}') format('truetype');
        }
        @font-face {
          font-family: 'MVMAthira-Bold';
          src: url('data:font/truetype;charset=utf-8;base64,${fonts.athiraBold}') format('truetype');
        }
        @font-face {
          font-family: 'MVMAthira-Normal';
          src: url('data:font/truetype;charset=utf-8;base64,${fonts.athiraNormal}') format('truetype');
        }
        @font-face {
          font-family: 'Gilmer-Regular';
          src: url('data:font/opentype;charset=utf-8;base64,${fonts.gilmerRegular}') format('opentype');
        }
        @font-face {
          font-family: 'Gilmer-Bold';
          src: url('data:font/opentype;charset=utf-8;base64,${fonts.gilmerBold}') format('opentype');
        }
        @font-face {
          font-family: 'Gilmer-Medium';
          src: url('data:font/opentype;charset=utf-8;base64,${fonts.gilmerMedium}') format('opentype');
        }
        @font-face {
          font-family: 'Gobold-Uplow';
          src: url('data:font/opentype;charset=utf-8;base64,${fonts.goboldUplow}') format('opentype');
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          width: 1200px;
          min-height: 1600px;
          background-color: #F3EFE9;
          background-image: url('${headerDataUrl}');
          background-size: 100% auto;
          background-position: top center;
          background-repeat: no-repeat;
          font-family: 'Gilmer-Regular', sans-serif;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* Main Container */
        .poster-container {
          position: relative;
          z-index: 2;
          width: 100%;
          min-height: 1600px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 240px 70px 45px 70px;
        }

        /* Date overlay absolute positioned over header image card space */
        .calendar-date-overlay {
          position: absolute;
          right: ${datePositionX ?? 80}px;
          top: ${datePositionY ?? 80}px;
          width: 210px;
          height: 98px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: white;
          text-align: left;
          pointer-events: none;
          z-index: 10;
        }

        .cal-line-1 {
          font-family: 'MVMAthira-Bold', sans-serif;
          font-size: 34px;
          font-weight: bold;
          line-height: 0.85;
        }

        .cal-line-2 {
          font-family: 'MVMAthira-Bold', sans-serif;
          font-size: 34px;
          font-weight: bold;
          line-height: 0.85;
          margin-top: 0px;
        }

        /* DYNAMIC SCHEDULE AREA */
        .schedule-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: ${rowGap};
          margin: 15px 0 25px 0;
        }

        /* Department Group Grid */
        .department-group {
          display: grid;
          grid-template-columns: 312px 1fr 250px;
          column-gap: 0;
          align-items: stretch;
          width: 100%;
        }

        /* Left Column: Department Badge */
        .dept-badge-col {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dept-badge {
          background-color: #4A6B82;
          color: white;
          border-top-left-radius: 24px;
          border-bottom-left-radius: 24px;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 15px 30px;
          text-align: left;
          line-height: 0.7;
          font-family: 'MVMAthira-Bold', sans-serif;
          font-weight: bold;
          box-shadow: 0 4px 10px rgba(74, 107, 130, 0.15);
          word-break: break-word;
          overflow: hidden;
        }

        /* Middle Column: Combined Doctors Card */
        .doctors-card {
          background-color: white;
          border: 1px solid #E4E7EB;
          border-radius: 0;
          border-left: none;
          border-right: none;
          padding: 10px 35px;
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }

        .doctor-info-row {
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }

        .doctor-name {
          font-family: 'MLKVShaji-Bold', sans-serif;
          color: #0E273C;
          line-height: 1.3;
          font-weight: bold;
        }

        .doctor-qual {
          font-family: 'Gilmer-Medium', sans-serif;
          color: #7E8B9A;
          margin-top: 4px;
          line-height: 0.9;
          word-break: break-word;
        }

        .card-divider {
          height: 1px;
          background-color: #E2E8F0;
          width: 100%;
        }

        /* Right Column: Time Badges */
        .time-badges-column {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .time-badge-wrapper {
          display: flex;
          flex: 1;
          width: 100%;
          box-sizing: border-box;
        }

        .time-badge {
          background-color: #4A6B82;
          color: white;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Gobold-Uplow', sans-serif;
          font-weight: bold;
          text-align: center;
          box-shadow: 0 4px 10px rgba(74, 107, 130, 0.15);
          box-sizing: border-box;
        }

        /* FIXED SERVICE ROW STYLE (Physiotherapy) */
        .fixed-service-row {
          display: grid;
          grid-template-columns: 1fr 250px;
          width: 100%;
          background-color: white;
          border: 1px solid #E4E7EB;
          border-radius: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
          overflow: hidden;
        }

        .fixed-service-card-left {
          padding: 15px 30px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          color: #148C8C;
          font-family: 'MVMAthira-Bold', sans-serif;
          font-size: 50px;
          font-weight: bold;
          text-align: left;
          line-height: 0.7;
          word-break: break-word;
          overflow: hidden;
        }

        .fixed-service-card-right {
          background-color: #4A6B82;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px 15px;
        }

        .fs-badge {
          background-color: #148C8C;
          color: white;
          border-radius: 8px;
          padding: 4px 12px;
          margin-bottom: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 2px 6px rgba(20, 140, 140, 0.15);
        }

        .fs-line-1 {
          font-family: 'MVMAthira-Bold', sans-serif;
          font-size: 14px;
          line-height: 1.25;
        }

        .fs-line-2 {
          font-family: 'Gobold-Uplow', sans-serif;
          font-size: 24px;
          font-weight: bold;
          color: white;
          line-height: 1;
        }

        /* FOOTER SECTION - RENDERED FROM DYNAMIC IMAGE */
        .footer {
          width: 100%;
          height: 353px;
          margin-top: 15px;
        }

        .footer-banner {
          width: 100%;
          height: 100%;
          object-fit: fill;
        }
      </style>
    </head>
    <body>
      <!-- Date overlay absolute positioned over header image card space -->
      <div class="calendar-date-overlay">
        <span class="cal-line-1">${calDayMonth}</span>
        <span class="cal-line-2">${calYearWeekday}</span>
      </div>

      <div class="poster-container">

        <!-- MIDDLE DYNAMIC SCHEDULE AREA -->
        <div class="schedule-area">
          ${rowsHtml}
        </div>

        <!-- FOOTER FROM PRE-RENDERED BANNER -->
        <div class="footer">
          <img class="footer-banner" src="${footerDataUrl}" alt="Footer Banner">
        </div>
      </div>
    </body>
    </html>
  `;
}
