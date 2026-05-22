export interface ZohoConnection {
  id: string;
  organizationId: string;
  organizationName: string;
  accessToken: string;
  refreshToken?: string;
  region: string;
  currency: string;
}

export interface Finding {
  title: string;
  severity: "High" | "Medium" | "Low";
  description: string;
  affectedEntries?: string[];
  recommendation?: string;
}

export interface AnalysisSections {
  completeness: Finding[];
  anomalies:    Finding[];
  duplicates:   Finding[];
  period:       Finding[];
  compliance:   Finding[];
}

export interface AnalysisSummary {
  overallRiskScore: "High" | "Medium" | "Low";
  executiveSummary: string;
  topRecommendations: string[];
  immediateActions: string[];
  top10Findings: Array<{ rank: number; title: string; severity: string; impact: string }>;
}

export interface Analysis {
  id: string;
  organizationName: string;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
  status: "complete" | "running" | "error";
  totalEntries: number;
  findingsCount: number;
  riskScore: "High" | "Medium" | "Low";
  sections: AnalysisSections;
  summary: AnalysisSummary;
  modelUsed?: string;
}

export interface AppSettings {
  connections: ZohoConnection[];
}
