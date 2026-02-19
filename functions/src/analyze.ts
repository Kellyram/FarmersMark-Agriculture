import {onRequest} from "firebase-functions/v2/https";
import {AnalysisRequest} from "./types";
import {CONFIG} from "./config";
import {loadFrameworkChunks, saveReport} from "./lib/firestore";
import {cosineSimilarity, generateAnalysis, generateQueryEmbedding} from "./lib/vertex";

function validateRequest(body: Partial<AnalysisRequest>): asserts body is AnalysisRequest {
  if (!body.policyText || !body.frameworks?.length || !body.userId) {
    throw new Error("policyText, frameworks[], and userId are required");
  }
}

export const analyzeDocument = onRequest({
  region: CONFIG.REGION,
  cors: true,
  timeoutSeconds: 540,
  memory: "1GiB",
}, async (req, res) => {
  try {
    validateRequest(req.body);
    const {policyText, frameworks, userId, policyId} = req.body;

    const queryEmbedding = await generateQueryEmbedding(policyText.slice(0, 4000));
    const chunks = await loadFrameworkChunks(frameworks);

    const ranked = chunks
      .map((chunk) => ({
        ...chunk,
        similarity: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0,
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, CONFIG.RAG.TOP_K);

    const context = ranked.map((chunk) =>
      `[${chunk.framework} p.${chunk.page}] ${chunk.text}`).join("\n\n");

    const prompt = [
      "You are a compliance analyst.",
      "Analyze this policy against the provided framework excerpts.",
      "Return gaps, risk areas, and concrete recommendations.",
      "",
      "Policy:",
      policyText,
      "",
      "Framework context:",
      context,
    ].join("\n");

    const analysis = await generateAnalysis(prompt);

    const report = {
      userId,
      policyId: policyId || null,
      frameworks,
      analysis,
      topChunks: ranked.map((r) => ({framework: r.framework, page: r.page, similarity: r.similarity})),
      createdAt: new Date(),
    };

    const reportId = await saveReport(report);
    res.json({success: true, reportId, analysis});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({success: false, error: message});
  }
});