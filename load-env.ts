/**
 * Preload for CLI tools (drizzle-kit, tsx scripts) that do not load `.env.local`
 * the way Next.js does. Imported as the first side-effect in `drizzle.config.ts`.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
