import React from "react";
import { Document as PDFDocument, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { eachWeekOfInterval, endOfMonth, startOfMonth, format } from "date-fns";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
}

// Pre-translated copy for the report. This component is rendered outside the
// Next.js request/render tree (invoked from an API route via @react-pdf/renderer),
// so it can't call useTranslations/getTranslations itself. HoursManagement.tsx
// resolves these strings with next-intl and sends them along in the request body.
// The *Template fields use %TOKEN% placeholders (not ICU {}) that get filled in
// below once values (name, hours, percentages, page numbers) are computed here.
interface HoursReportLabels {
  table: {
    tutorName: string;
    allSessions: string;
    biweeklyMeetings: string;
    tutorReferral: string;
    subHotline: string;
    other: string;
    allTimeTotal: string;
    thisMonth: string;
    totals: string;
  };
  header: {
    allTimeTitle: string;
    monthlyTitle: string;
    allTimeSubtitle: string;
    monthlySubtitleTemplate: string;
    generatedOnTemplate: string;
  };
  stats: {
    title: string;
    activeTutors: string;
    totalHours: string;
    avgHoursPerTutor: string;
    eventHours: string;
  };
  insights: {
    title: string;
    topPerformerTemplate: string;
    activePercentageTemplate: string;
    eventPercentageTemplate: string;
  };
  footer: {
    title: string;
    reportPeriodTemplate: string;
    reportPeriodAllTime: string;
    pageOfTemplate: string;
  };
  monthAbbreviations: string[];
}

interface HoursPDFData {
  selectedDate: Date;
  tutors: Profile[];
  allTimeView: boolean;
  totalSessionHours: { [key: string]: number };
  totalEventHours: { [key: string]: number };
  totalMonthlyHours: number;
  totalHours: number;
  allTimeSessionHours: { [key: string]: number };
  eventHoursData: { [key: string]: { [key: string]: number } };
  allTimeHours: { [key: string]: number };
  weeklySessionHours: { [key: string]: { [key: string]: number } };
  monthlyHours: { [key: string]: number };
  filteredTutors: Profile[];
  logoUrl?: string;
  labels: HoursReportLabels;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },

  // Header Styles
  header: {
    marginBottom: 25,
    borderBottom: "2px solid #2563eb",
    paddingBottom: 15,
    position: "relative",
  },
  headerContent: {
    // paddingLeft: 70, // Make room for logo
  },
  companyName: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1e40af",
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#374151",
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 12,
    textAlign: "center",
    color: "#6b7280",
    marginBottom: 5,
  },
  reportDate: {
    fontSize: 10,
    textAlign: "center",
    color: "#9ca3af",
  },

  // Table Styles
  tableContainer: {
    marginBottom: 20,
  },
  table: {
    width: "100%",
    borderRadius: 4,
    overflow: "hidden",
    borderStyle: "solid",
    borderWidth: 1.5,
    borderColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderBottomStyle: "solid",
    minHeight: 28, // Ensure consistent row height
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },

  // Header Cells
  tableColHeader: {
    backgroundColor: "#f8fafc",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    borderRightStyle: "solid",
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 32,
    justifyContent: "center", // Center content vertically
  },
  tutorNameColHeader: {
    width: "18%",
    backgroundColor: "#f1f5f9",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    borderRightStyle: "solid",
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 32,
    justifyContent: "center",
  },

  // Data Cells
  tableCol: {
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    borderRightStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 28,
    justifyContent: "center",
  },
  tutorNameCol: {
    width: "18%",
    backgroundColor: "#fefefe",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    borderRightStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 28,
    justifyContent: "center",
  },

  // Text Styles
  tableCellHeader: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    color: "#374151",
    lineHeight: 1.2,
  },
  tableCell: {
    fontSize: 8,
    textAlign: "center",
    color: "#4b5563",
  },
  tutorNameCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1f2937",
  },

  // Special Rows
  totalsRow: {
    backgroundColor: "#dbeafe",
    borderTopWidth: 2,
    borderTopColor: "#2563eb",
    borderTopStyle: "solid",
    minHeight: 28, // Consistent height
  },
  totalsCell: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1e40af",
  },

  // Statistics Section
  statsSection: {
    marginTop: 25,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 15,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  statsCard: {
    width: "22%",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "solid",
    alignItems: "center",
  },
  statsValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },

  // Performance Insights
  insightsSection: {
    marginTop: 15,
  },
  insightsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 10,
  },
  insightItem: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "center",
  },
  insightBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2563eb",
    marginRight: 8,
  },
  insightText: {
    fontSize: 9,
    color: "#4b5563",
    lineHeight: 1.3,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

// Fills %TOKEN% placeholders in a pre-translated template string with computed values.
// Plain %TOKEN% (rather than ICU {token}) so the templates can be resolved with
// next-intl's t() with no arguments in HoursManagement.tsx and interpolated here once
// the actual numbers/names are known.
function fillTemplate(template: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (result, [token, value]) => result.split(`%${token}%`).join(String(value)),
    template,
  );
}

// Chunk tutors into groups that fit on a page
const chunkTutors = (tutors: Profile[], maxPerPage: number = 15): Profile[][] => {
  const chunks: Profile[][] = [];
  for (let i = 0; i < tutors.length; i += maxPerPage) {
    chunks.push(tutors.slice(i, i + maxPerPage));
  }
  return chunks;
};

const chunkTutorsCustom = (tutors: Profile[]): Profile[][] => {
  const chunks: Profile[][] = [];
  let currentIndex = 0;

  // First page: 12 tutors
  if (tutors.length > 0) {
    const firstPageTutors = tutors.slice(0, Math.min(11, tutors.length));
    chunks.push(firstPageTutors);
    currentIndex = firstPageTutors.length;
  }

  // Subsequent pages: 17 tutors each
  while (currentIndex < tutors.length) {
    const nextChunk = tutors.slice(currentIndex, currentIndex + 17);
    chunks.push(nextChunk);
    currentIndex += 17;
  }

  return chunks;
};

// Component for rendering table headers
const TableHeader: React.FC<{
  allTimeView: boolean;
  weeksInMonth: Date[];
  colWidth: string;
  labels: HoursReportLabels;
}> = ({ allTimeView, weeksInMonth, colWidth, labels }) => {
  const formatDateRange = (date: Date): string => {
    return `${labels.monthAbbreviations[date.getMonth()]} ${date.getDate()}`;
  };

  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  return (
    <View style={styles.tableRow}>
      <View style={styles.tutorNameColHeader}>
        <Text style={styles.tableCellHeader}>{labels.table.tutorName}</Text>
      </View>

      {allTimeView ? (
        <>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.allSessions}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.biweeklyMeetings}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.tutorReferral}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.subHotline}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.other}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.allTimeTotal}</Text>
          </View>
        </>
      ) : (
        <>
          {weeksInMonth.map((week) => (
            <View key={week.toISOString()} style={[styles.tableColHeader, { width: colWidth }]}>
              <Text style={styles.tableCellHeader}>
                {formatDateRange(week)} -{"\n"}
                {formatDateRange(addDays(week, 6))}
              </Text>
            </View>
          ))}
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.biweeklyMeetings}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.tutorReferral}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.subHotline}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.other}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.thisMonth}</Text>
          </View>
          <View style={[styles.tableColHeader, { width: colWidth }]}>
            <Text style={styles.tableCellHeader}>{labels.table.allTimeTotal}</Text>
          </View>
        </>
      )}
    </View>
  );
};

// Component for rendering totals row
const TotalsRow: React.FC<{
  allTimeView: boolean;
  weeksInMonth: Date[];
  colWidth: string;
  totalSessionHours: { [key: string]: number };
  totalEventHours: { [key: string]: number };
  totalMonthlyHours: number;
  totalHours: number;
  labels: HoursReportLabels;
}> = ({
  allTimeView,
  weeksInMonth,
  colWidth,
  totalSessionHours,
  totalEventHours,
  totalMonthlyHours,
  totalHours,
  labels,
}) => {
  if (allTimeView) return null;

  return (
    <View style={[styles.tableRow, styles.totalsRow]}>
      <View style={styles.tutorNameCol}>
        <Text style={[styles.tutorNameCell, { color: "#1e40af" }]}>{labels.table.totals}</Text>
      </View>

      {weeksInMonth.map((week) => {
        const hours = totalSessionHours[week.getTime().toString()] || 0;
        return (
          <View key={week.toString()} style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.totalsCell}>{hours ? hours.toFixed(1) : "-"}</Text>
          </View>
        );
      })}

      <View style={[styles.tableCol, { width: colWidth }]}>
        <Text style={styles.totalsCell}>
          {totalEventHours["Biweekly Meeting"]
            ? totalEventHours["Biweekly Meeting"].toFixed(1)
            : "-"}
        </Text>
      </View>
      <View style={[styles.tableCol, { width: colWidth }]}>
        <Text style={styles.totalsCell}>
          {totalEventHours["Tutor Referral"] ? totalEventHours["Tutor Referral"].toFixed(1) : "-"}
        </Text>
      </View>
      <View style={[styles.tableCol, { width: colWidth }]}>
        <Text style={styles.totalsCell}>
          {totalEventHours["Sub Hotline"] ? totalEventHours["Sub Hotline"].toFixed(1) : "-"}
        </Text>
      </View>
      <View style={[styles.tableCol, { width: colWidth }]}>
        <Text style={styles.totalsCell}>
          {totalEventHours["Other"] ? totalEventHours["Other"].toFixed(1) : "-"}
        </Text>
      </View>
      <View style={[styles.tableCol, { width: colWidth }]}>
        <Text style={styles.totalsCell}>
          {totalMonthlyHours ? totalMonthlyHours.toFixed(1) : "-"}
        </Text>
      </View>
      <View style={[styles.tableCol, { width: colWidth }]}>
        <Text style={styles.totalsCell}>{totalHours}</Text>
      </View>
    </View>
  );
};

// Component for rendering tutor rows
const TutorRow: React.FC<{
  tutor: Profile;
  isLast: boolean;
  allTimeView: boolean;
  weeksInMonth: Date[];
  colWidth: string;
  allTimeSessionHours: { [key: string]: number };
  eventHoursData: { [key: string]: { [key: string]: number } };
  allTimeHours: { [key: string]: number };
  weeklySessionHours: { [key: string]: { [key: string]: number } };
  monthlyHours: { [key: string]: number };
}> = ({
  tutor,
  isLast,
  allTimeView,
  weeksInMonth,
  colWidth,
  allTimeSessionHours,
  eventHoursData,
  allTimeHours,
  weeklySessionHours,
  monthlyHours,
}) => {
  return (
    <View style={[styles.tableRow, isLast ? styles.tableRowLast : {}]}>
      <View style={styles.tutorNameCol}>
        <Text style={styles.tutorNameCell}>
          {tutor.firstName} {tutor.lastName}
        </Text>
      </View>

      {allTimeView ? (
        <>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {allTimeSessionHours[tutor.id] ? allTimeSessionHours[tutor.id].toFixed(1) : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Biweekly Meeting"]
                ? eventHoursData[tutor.id]["Biweekly Meeting"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Tutor Referral"]
                ? eventHoursData[tutor.id]["Tutor Referral"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Sub Hotline"]
                ? eventHoursData[tutor.id]["Sub Hotline"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Other"]
                ? eventHoursData[tutor.id]["Other"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={[styles.tableCell, { fontWeight: "bold", color: "#1e40af" }]}>
              {allTimeHours[tutor.id] ? allTimeHours[tutor.id].toFixed(1) : "-"}
            </Text>
          </View>
        </>
      ) : (
        <>
          {weeksInMonth.map((week) => {
            const hours = weeklySessionHours[tutor.id]?.[week.getTime().toString()] || 0;
            return (
              <View key={week.toString()} style={[styles.tableCol, { width: colWidth }]}>
                <Text style={styles.tableCell}>{hours ? hours.toFixed(1) : "-"}</Text>
              </View>
            );
          })}

          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Biweekly Meetings"]
                ? eventHoursData[tutor.id]["Biweekly Meetings"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Tutor Referral"]
                ? eventHoursData[tutor.id]["Tutor Referral"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Sub Hotline"]
                ? eventHoursData[tutor.id]["Sub Hotline"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {eventHoursData[tutor.id]?.["Other"]
                ? eventHoursData[tutor.id]["Other"].toFixed(1)
                : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={[styles.tableCell, { fontWeight: "bold", color: "#1e40af" }]}>
              {monthlyHours[tutor.id] ? monthlyHours[tutor.id].toFixed(1) : "-"}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: colWidth }]}>
            <Text style={styles.tableCell}>
              {allTimeHours[tutor.id] ? allTimeHours[tutor.id].toFixed(1) : "-"}
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const HoursPDFDocument: React.FC<{ data: HoursPDFData }> = ({ data }) => {
  const {
    tutors,
    selectedDate,
    allTimeView,
    totalSessionHours,
    totalEventHours,
    totalMonthlyHours,
    totalHours,
    allTimeSessionHours,
    eventHoursData,
    allTimeHours,
    weeklySessionHours,
    monthlyHours,
    filteredTutors,
    logoUrl,
    labels,
  } = data;

  const weeksInMonth = eachWeekOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  });

  // Calculate column width based on number of columns
  const getColumnWidth = () => {
    if (allTimeView) {
      return "13.5%"; // 6 columns total (excluding tutor name)
    } else {
      const totalCols = weeksInMonth.length + 5;
      return `${Math.min(82 / totalCols, 11)}%`;
    }
  };

  const colWidth = getColumnWidth();

  // Calculate statistics
  const calculateStats = () => {
    const activeTutors = filteredTutors.filter((tutor) => {
      const hasSessionHours = allTimeView
        ? (allTimeSessionHours[tutor.id] || 0) > 0
        : Object.values(weeklySessionHours[tutor.id] || {}).some((hours) => hours > 0);
      const hasEventHours = Object.values(eventHoursData[tutor.id] || {}).some(
        (hours) => hours > 0,
      );
      return hasSessionHours || hasEventHours;
    });

    const totalTutorHours = filteredTutors.reduce((sum, tutor) => {
      return sum + (allTimeView ? allTimeHours[tutor.id] || 0 : monthlyHours[tutor.id] || 0);
    }, 0);

    const averageHoursPerTutor =
      activeTutors.length > 0 ? totalTutorHours / activeTutors.length : 0;

    const topPerformer = filteredTutors.reduce((top, tutor) => {
      const tutorHours = allTimeView ? allTimeHours[tutor.id] || 0 : monthlyHours[tutor.id] || 0;
      const topHours = allTimeView ? allTimeHours[top?.id] || 0 : monthlyHours[top?.id] || 0;
      return tutorHours > topHours ? tutor : top;
    }, filteredTutors[0]);

    const totalEventHoursSum = Object.values(totalEventHours).reduce(
      (sum, hours) => sum + (hours || 0),
      0,
    );

    return {
      activeTutors: activeTutors.length,
      totalHours: totalTutorHours,
      averageHours: averageHoursPerTutor,
      topPerformer,
      totalEventHours: totalEventHoursSum,
    };
  };

  const stats = calculateStats();

  // Chunk tutors for pagination - adjust based on available space
  const tutorChunks = chunkTutorsCustom(filteredTutors);
  const totalPages = tutorChunks.length;

  return (
    <PDFDocument>
      {tutorChunks.map((tutorChunk, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          {/* Header Section - only on first page */}
          {pageIndex === 0 && (
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Text style={styles.companyName}>Connect Me Tutoring</Text>
                <Text style={styles.reportTitle}>
                  {allTimeView ? labels.header.allTimeTitle : labels.header.monthlyTitle}
                </Text>
                <Text style={styles.reportSubtitle}>
                  {allTimeView
                    ? labels.header.allTimeSubtitle
                    : fillTemplate(labels.header.monthlySubtitleTemplate, {
                        DATE: format(selectedDate, "MMMM yyyy"),
                      })}
                </Text>
                <Text style={styles.reportDate}>
                  {fillTemplate(labels.header.generatedOnTemplate, {
                    DATE: format(new Date(), "MMMM dd, yyyy 'at' HH:mm"),
                  })}
                </Text>
              </View>
            </View>
          )}

          {/* Main Table */}
          <View style={styles.tableContainer}>
            <View style={styles.table}>
              {/* Header Row - repeat on each page */}
              <TableHeader
                allTimeView={allTimeView}
                weeksInMonth={weeksInMonth}
                colWidth={colWidth}
                labels={labels}
              />

              {/* Totals Row - only on first page and only for monthly view */}
              {pageIndex === 0 && (
                <TotalsRow
                  allTimeView={allTimeView}
                  weeksInMonth={weeksInMonth}
                  colWidth={colWidth}
                  totalSessionHours={totalSessionHours}
                  totalEventHours={totalEventHours}
                  totalMonthlyHours={totalMonthlyHours}
                  totalHours={totalHours}
                  labels={labels}
                />
              )}

              {/* Data Rows for this page */}
              {tutorChunk.map((tutor, index) => (
                <TutorRow
                  key={tutor.id}
                  tutor={tutor}
                  isLast={index === tutorChunk.length - 1}
                  allTimeView={allTimeView}
                  weeksInMonth={weeksInMonth}
                  colWidth={colWidth}
                  allTimeSessionHours={allTimeSessionHours}
                  eventHoursData={eventHoursData}
                  allTimeHours={allTimeHours}
                  weeklySessionHours={weeklySessionHours}
                  monthlyHours={monthlyHours}
                />
              ))}
            </View>
          </View>

          {/* Statistics Section - only on last page */}
          {pageIndex === totalPages - 1 && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>{labels.stats.title}</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statsCard}>
                  <Text style={styles.statsValue}>{stats.activeTutors}</Text>
                  <Text style={styles.statsLabel}>{labels.stats.activeTutors}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Text style={styles.statsValue}>{stats.totalHours.toFixed(1)}</Text>
                  <Text style={styles.statsLabel}>{labels.stats.totalHours}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Text style={styles.statsValue}>{stats.averageHours.toFixed(1)}</Text>
                  <Text style={styles.statsLabel}>{labels.stats.avgHoursPerTutor}</Text>
                </View>

                <View style={styles.statsCard}>
                  <Text style={styles.statsValue}>{stats.totalEventHours.toFixed(1)}</Text>
                  <Text style={styles.statsLabel}>{labels.stats.eventHours}</Text>
                </View>
              </View>

              <View style={styles.insightsSection}>
                <Text style={styles.insightsTitle}>{labels.insights.title}</Text>

                <View style={styles.insightItem}>
                  <View style={styles.insightBullet} />
                  <Text style={styles.insightText}>
                    {fillTemplate(labels.insights.topPerformerTemplate, {
                      NAME: `${stats.topPerformer?.firstName} ${stats.topPerformer?.lastName}`,
                      HOURS: allTimeView
                        ? (allTimeHours[stats.topPerformer?.id] || 0).toFixed(1)
                        : (monthlyHours[stats.topPerformer?.id] || 0).toFixed(1),
                    })}
                  </Text>
                </View>

                <View style={styles.insightItem}>
                  <View style={styles.insightBullet} />
                  <Text style={styles.insightText}>
                    {fillTemplate(labels.insights.activePercentageTemplate, {
                      PERCENT: Math.round((stats.activeTutors / filteredTutors.length) * 100),
                    })}
                  </Text>
                </View>

                <View style={styles.insightItem}>
                  <View style={styles.insightBullet} />
                  <Text style={styles.insightText}>
                    {fillTemplate(labels.insights.eventPercentageTemplate, {
                      PERCENT: Math.round((stats.totalEventHours / stats.totalHours) * 100),
                    })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Footer - on every page */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{labels.footer.title}</Text>
            <Text style={styles.footerText}>
              {fillTemplate(labels.footer.reportPeriodTemplate, {
                PERIOD: allTimeView
                  ? labels.footer.reportPeriodAllTime
                  : format(selectedDate, "MMMM yyyy"),
              })}
            </Text>
            <Text style={styles.footerText}>
              {fillTemplate(labels.footer.pageOfTemplate, {
                PAGE: pageIndex + 1,
                TOTAL: totalPages,
              })}
            </Text>
          </View>
        </Page>
      ))}
    </PDFDocument>
  );
};

export default HoursPDFDocument;
