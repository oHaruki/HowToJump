/**
 * Loaded as the very first import of any CLI script.
 *
 * ESM evaluates every import before the importing module's own body runs, so
 * calling dotenv inside seed.ts would happen after db.ts had already read
 * process.env. Keeping it in its own module fixes that ordering.
 */
import { config } from "dotenv";

// .env.local first, so local settings win over a committed .env.
config({ path: [".env.local", ".env"] });
