export type AnalyzePayload = {
  policyText: string;
  frameworks: string[];
  userId: string;
  policyId?: string;
};

export type AnalyzeResponse = {
  success: boolean;
  reportId?: string;
  analysis?: string;
  error?: string;
};

export type Report = {
  id: string;
  userId: string;
  policyId: string | null;
  frameworks: string[];
  analysis: string;
  createdAt?: unknown;
};

export type ReportsResponse = {
  success: boolean;
  reports: Report[];
  error?: string;
};