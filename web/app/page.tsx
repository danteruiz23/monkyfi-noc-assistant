import Overview, { type OverviewData } from "@/components/Overview";
import { correlate, pyFloatRepr, suggest } from "@/lib";
import { loadAlerts, loadRunbooks } from "@/lib/data";

// Built once at build time from the synthetic data in web/data/.
export const dynamic = "force-static";

export default function Page() {
  const incidents = correlate(loadAlerts());
  const main = incidents[0];
  const top = suggest(main, loadRunbooks())[0];
  const data: OverviewData = {
    incidentCount: incidents.length,
    eventCount: main.event_count,
    durationText: pyFloatRepr(main.duration_minutes),
    tickets: main.ticket_ids,
    probableCause: main.probable_cause,
    runbookId: top ? top.runbook_id : "—",
  };
  return <Overview data={data} />;
}
