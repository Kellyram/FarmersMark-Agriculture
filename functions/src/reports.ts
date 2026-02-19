import {onRequest} from "firebase-functions/v2/https";
import {getUserReports} from "./lib/firestore";
import {CONFIG} from "./config";

export const getReports = onRequest({
  region: CONFIG.REGION,
  cors: true,
}, async (req, res) => {
  try {
    const userId = String(req.query.userId || "");

    if (!userId) {
      res.status(400).json({success: false, error: "userId query parameter is required"});
      return;
    }

    const reports = await getUserReports(userId);
    res.json({success: true, reports});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({success: false, error: message});
  }
});