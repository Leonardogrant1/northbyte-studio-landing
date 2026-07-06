import { R2_BUCKETS } from "./src/lib/r2-constants.js";
import { getPublicUrl } from "./src/lib/r2.js";
import dotenv from "dotenv";

dotenv.config();

console.log(getPublicUrl("n8n-media" as any, "test.png"));
