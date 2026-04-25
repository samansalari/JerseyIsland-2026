import "./bootstrap-env";
import { generatePulseInsight } from "../src/lib/pulse-insight";

generatePulseInsight()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error("[generate-pulse-insight]", e);
    process.exit(1);
  });
