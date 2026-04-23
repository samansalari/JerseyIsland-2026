/**
 * Load `.env.local` before any other app modules read `process.env`.
 * Import as the first side-effect in CLI scripts:
 *   import "./bootstrap-env";
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
