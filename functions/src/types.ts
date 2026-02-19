export type FrameworkChunk = {
  text: string;
  page: number;
  embedding?: number[];
};

export type AnalysisRequest = {
  policyText: string;
  frameworks: string[];
  userId: string;
  policyId?: string;
};