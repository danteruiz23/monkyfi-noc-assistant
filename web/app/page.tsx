import NocApp from "@/components/NocApp";
import { loadRawData } from "@/lib/data";

// Built once at build time from the synthetic data in web/data/. Everything
// else (correlation, replay, import) runs in the browser: no server, no keys.
export const dynamic = "force-static";

export default function Page() {
  return <NocApp data={loadRawData()} />;
}
