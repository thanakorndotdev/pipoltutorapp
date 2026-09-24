import { Countdown, type CountdownProps } from "@/components/countdown";
import { fetchExamSettings } from "@/lib/api";
import { ENROLL_CLOSE_LABEL, EXAM_DATE, EXAM_DATE_LABEL } from "@/lib/content";
import { formatThaiDate } from "@/lib/format";

/**
 * Server side of the countdown: reads exam_settings from the backend and
 * hands the client component plain strings. Falls back to the placeholder
 * dates in lib/content when the backend is unreachable so the landing page
 * still renders.
 */
export async function CountdownSection() {
  let props: CountdownProps;
  try {
    const s = await fetchExamSettings();
    props = {
      examDate: s.examDate,
      examDateLabel: formatThaiDate(s.examDate),
      enrollCloseLabel: formatThaiDate(s.enrollCloseAt),
      venueLabel: s.examVenueLabel,
      urgentDays: s.urgentDays,
      serverNow: s.serverNow,
    };
  } catch (error) {
    console.error("exam settings unavailable, using placeholder dates:", error);
    props = {
      examDate: EXAM_DATE.toISOString(),
      examDateLabel: EXAM_DATE_LABEL,
      enrollCloseLabel: ENROLL_CLOSE_LABEL,
      venueLabel: "จภ.",
      urgentDays: 30,
      serverNow: new Date().toISOString(),
    };
  }
  return <Countdown {...props} />;
}
