import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {CONFIG} from "../config";
import {FrameworkChunk} from "../types";

initializeApp();
const db = getFirestore();

export async function loadFrameworkChunks(frameworks: string[]): Promise<Array<FrameworkChunk & {framework: string}>> {
  const result: Array<FrameworkChunk & {framework: string}> = [];

  for (const framework of frameworks) {
    const chunksSnapshot = await db.collection(CONFIG.COLLECTIONS.FRAMEWORKS)
      .doc(framework)
      .collection("chunks")
      .get();

    chunksSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      result.push({
        framework,
        text: String(data.text || ""),
        page: Number(data.page || 0),
        embedding: Array.isArray(data.embedding) ? data.embedding : undefined,
      });
    });
  }

  return result;
}

export async function getUserReports(userId: string) {
  const snapshot = await db.collection(CONFIG.COLLECTIONS.REPORTS)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
}

export async function saveReport(report: Record<string, unknown>) {
  const ref = await db.collection(CONFIG.COLLECTIONS.REPORTS).add(report);
  return ref.id;
}