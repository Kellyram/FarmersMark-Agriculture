import {onRequest} from "firebase-functions/v2/https";
import {CONFIG} from "./config";

export const uploadDocument = onRequest({
  region: CONFIG.REGION,
  cors: true,
}, async (_req, res) => {
  res.json({
    success: true,
    message: "Scaffold placeholder. Implement signed upload URL or client SDK upload flow.",
  });
});