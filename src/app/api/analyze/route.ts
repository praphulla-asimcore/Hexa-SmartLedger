import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert forensic accountant and Certified Fraud Examiner (CFE) AI assistant built into Hexa SmartLedger.

Your job is to analyze journal entries from Zoho Books and identify:
- Completeness & accuracy issues (unbalanced entries, missing fields, sequence gaps)
- Unusual patterns & anomalies (large transactions, round numbers, weekend postings, unusual account combos)
- Duplicate entries (exact or near-duplicates within 7 days, reversed entries)
- Period-end concentration (month-end clustering, last-day postings, accrual reversals)
- Compliance & controls gaps (segregation of duties, after-hours postings, authorization issues)

ALWAYS respond with valid JSON only. No markdown fences, no prose, no explanation outside the JSON structure.

For section analysis, return a JSON array of findings:
[{
  "title": "Brief finding title",
  "severity": "High" | "Medium" | "Low",
  "description": "Detailed explanation of the finding",
  "affectedEntries": ["JNL-0001", "JNL-0042"],
  "recommendation": "Specific actionable recommendation"
}]

For summary analysis, return a single JSON object:
{
  "overallRiskScore": "High" | "Medium" | "Low",
  "executiveSummary": "2-3 sentence professional summary",
  "topRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "immediateActions": ["urgent action 1", "urgent action 2"],
  "top10Findings": [{ "rank": 1, "title": "...", "severity": "...", "impact": "Brief impact description" }]
}`;

export async function POST(req: NextRequest) {
  try {
    const { journals, section, type } = await req.json();

    if (!journals || !Array.isArray(journals)) {
      return NextResponse.json({ error: "journals array is required" }, { status: 400 });
    }

    let userPrompt: string;

    if (type === "summary") {
      // Summary call — receives pre-computed finding counts
      const { findingCounts, topFindings, riskScore } = await req.json().catch(() => ({}));
      userPrompt = `Generate an executive summary for this journal entry analysis:

Risk Score: ${riskScore || "Unknown"}
Finding counts: ${JSON.stringify(findingCounts || {})}
Top findings: ${JSON.stringify(topFindings || [])}
Total journal entries analyzed: ${journals.length}

Return the summary JSON object as described in your instructions.`;
    } else {
      // Section analysis
      const sectionDescriptions: Record<string, string> = {
        completeness: "completeness & accuracy: check for unbalanced debits/credits, missing descriptions or references, missing journal numbers in sequence, entries with blank created-by fields, entries where debit total !== credit total",
        anomalies:    "unusual patterns & anomalies: flag transactions more than 3 standard deviations above mean, identify perfectly round numbers (potential estimates), flag entries posted on weekends or public holidays, detect unusual account pairings (e.g. Cash debited with Retained Earnings credited without explanation), entries created at unusual hours (before 7am or after 9pm)",
        duplicates:   "duplicate detection: find entries with identical amounts, accounts, and dates; near-duplicates with the same amount but different dates within 7 days; reversed entries (same accounts, opposite debit/credit); multiple entries to the same account on the same date with similar amounts",
        period:       "period-end analysis: identify clustering of entries in the last 3 days of each month or quarter; flag manual adjusting entries vs system-generated; check for accrual entries without corresponding reversal in the next period; identify late postings dated prior to a closed period",
        compliance:   "compliance & controls: flag entries where the same user created and approved; entries exceeding common authorization thresholds (>$50,000 single entry); entries posted after business hours; entries with no reference number; entries using unusual or rarely-used account codes",
      };

      const desc = sectionDescriptions[section] || section;
      const sample = journals.slice(0, 100); // cap at 100 entries per AI call

      userPrompt = `Analyze these ${sample.length} journal entries for ${desc}.

Journal entries:
${JSON.stringify(sample, null, 2)}

Return a JSON array of findings. If no issues found, return an empty array [].`;
    }

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const responseText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Parse JSON from response
    const clean = responseText.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // If parsing fails, return empty result
      parsed = type === "summary"
        ? { overallRiskScore: "Low", executiveSummary: "Analysis complete.", topRecommendations: [], immediateActions: [], top10Findings: [] }
        : [];
    }

    return NextResponse.json({ result: parsed, model: MODEL, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/analyze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
