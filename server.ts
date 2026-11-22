/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface HourlyMetricInput {
  hourLabel: string;
  currentRevenue: number;
  baselineRevenue: number;
  currentOrders: number;
  baselineOrders: number;
  deltaPct: number;
}

interface OutletPerformanceInput {
  outletName: string;
  city: string;
  currentRevenue: number;
  baselineExpectedRevenue: number;
  deltaPct: number;
  ordersCount: number;
  cancelledCount: number;
}

interface AnalyzeAlertsRequestBody {
  outletScope: string;
  dateRangeLabel: string;
  currentHourLabel: string;
  summary: {
    totalSales: number;
    ordersCount: number;
    avgBill: number;
    cancelledCount: number;
    cancellationRatePct: number;
  };
  hourlySeries: HourlyMetricInput[];
  outletPerformances: OutletPerformanceInput[];
  recentBurst: {
    last15MinOrders: number;
    last15MinRevenue: number;
    highPriorityCount: number;
    latestBillSummary?: string;
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function extractGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const statusMatch = raw.match(/\b(400|401|403|404|429|500|502|503)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 500;

  if (raw.includes("API_KEY_INVALID") || raw.includes("PERMISSION_DENIED") || status === 403) {
    return {
      status: 403,
      message:
        "Gemini API access was denied. Please check your GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || status === 429) {
    return {
      status: 429,
      message:
        "Gemini API rate limit reached. Please wait a moment or check your quota in Settings > Secrets.",
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: raw || "Failed to analyze real-time sales anomalies with Gemini.",
  };
}

async function generateAnomalyAlertsWithRetry(
  ai: GoogleGenAI,
  payload: AnalyzeAlertsRequestBody
) {
  const prompt = [
    "Analyze the following live restaurant POS telemetry and detect unusual sales spikes, drops, cancellation surges, or ticket-size surges compared against historical baselines.",
    "Return 2 to 5 concise, high-signal alerts grounded strictly in the provided figures (never invent outlets or metrics not present in the JSON).",
    "If no sharp anomaly exceeds ~15% variance, still surface the most notable positive or negative movement observed so the manager has clear real-time context.",
    "",
    `Telemetry Context JSON:\n${JSON.stringify(payload)}`,
  ].join("\n");

  const systemInstruction =
    "You are a real-time restaurant operations anomaly detector for Petpooja POS. Identify unusual sales spikes, revenue drops, sudden cancellation clusters, or high-value order bursts across outlets and hourly time slots. Keep explanations factual, numeric, and under 2 sentences.";

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description:
                  "One-sentence real-time executive summary of current sales activity and anomalies.",
              },
              overallStatus: {
                type: Type.STRING,
                description:
                  "One of: nominal, spike_detected, drop_detected, mixed_anomalies",
              },
              alerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: {
                      type: Type.STRING,
                      description:
                        "One of: spike, drop, cancellation_surge, ticket_surge",
                    },
                    severity: {
                      type: Type.STRING,
                      description: "One of: critical, warning, positive",
                    },
                    title: {
                      type: Type.STRING,
                      description: "Short 4-8 word alert headline.",
                    },
                    outletName: {
                      type: Type.STRING,
                      description:
                        "Affected outlet name from telemetry or All Outlets.",
                    },
                    metricValue: {
                      type: Type.STRING,
                      description: "Signed variance or key figure e.g. +38.4% or -24.1%.",
                    },
                    timeframe: {
                      type: Type.STRING,
                      description: "Window such as 19:00-20:00 or Last 15 mins.",
                    },
                    explanation: {
                      type: Type.STRING,
                      description: "Concise 1-2 sentence explanation citing actual numbers.",
                    },
                    recommendedAction: {
                      type: Type.STRING,
                      description: "Single actionable step for the manager.",
                    },
                  },
                  required: [
                    "id",
                    "type",
                    "severity",
                    "title",
                    "outletName",
                    "metricValue",
                    "timeframe",
                    "explanation",
                    "recommendedAction",
                  ],
                },
              },
            },
            required: ["summary", "overallStatus", "alerts"],
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      return JSON.parse(rawText);
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/alerts/analyze", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "GEMINI_API_KEY is not configured. Add your key in the Settings > Secrets panel to enable real-time AI anomaly alerts.",
      });
      return;
    }

    const body = req.body as AnalyzeAlertsRequestBody | undefined;
    if (!body || !body.summary) {
      res.status(400).json({ error: "Missing sales telemetry context payload." });
      return;
    }

    try {
      const analysis = await generateAnomalyAlertsWithRetry(ai, body);
      res.json({
        ...analysis,
        analyzedAt: new Date().toISOString(),
      });
    } catch (err) {
      const parsed = extractGeminiError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  const distDir = path.resolve(__dirname, "dist");
  const isProd =
    process.env.NODE_ENV === "production" ||
    (process.env.npm_lifecycle_event === "start" && fs.existsSync(path.join(distDir, "index.html")));

  if (isProd) {
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
