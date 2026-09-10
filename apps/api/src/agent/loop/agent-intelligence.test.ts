import { describe, expect, test } from "bun:test";
import { extractQueryKeywords } from "./ranking-synonyms";
import { scoreToolForQuery } from "./ranking";
import { handleStepFinish } from "./finish";
import { toolFailGuidance, policyDenialGuidance } from "./guidance";
import { createRunCounters } from "./context";
import type { NormalizedTool } from "../../policies/normalize";

describe("AI Agent Super-Intelligence & Tool Logic", () => {
  test("extractQueryKeywords expands Indonesian multi-domain synonyms", () => {
    // Coding & workspace
    const codeKws = extractQueryKeywords("Tolong buatkan fungsi dan tulis kode baru di workspace");
    expect(codeKws.has("code")).toBe(true);
    expect(codeKws.has("file")).toBe(true);
    expect(codeKws.has("write")).toBe(true);
    expect(codeKws.has("workspace")).toBe(true);

    // Shell & test
    const shellKws = extractQueryKeywords("Jalankan testing dan eksekusi command build");
    expect(shellKws.has("execute")).toBe(true);
    expect(shellKws.has("shell")).toBe(true);
    expect(shellKws.has("test")).toBe(true);
    expect(shellKws.has("build")).toBe(true);

    // Web research
    const webKws = extractQueryKeywords("Cari info harga dan riset berita terbaru");
    expect(webKws.has("search")).toBe(true);
    expect(webKws.has("web")).toBe(true);
    expect(webKws.has("research")).toBe(true);
    expect(webKws.has("price")).toBe(true);

    // Telegram & Gmail
    const teleKws = extractQueryKeywords("Kirim pesan lewat bot telegram dan periksa inbox email");
    expect(webKws.size).toBeGreaterThan(0);
    expect(teleKws.has("telegram")).toBe(true);
    expect(teleKws.has("bot")).toBe(true);
    expect(teleKws.has("mail")).toBe(true);
    expect(teleKws.has("gmail")).toBe(true);
  });

  test("scoreToolForQuery boosts tools based on query domain and keywords", () => {
    const writeFileTool: NormalizedTool = {
      fqName: "general:write_file",
      rawName: "write_file",
      origin: "custom",
      risk: "write",
      classificationProvenance: "custom-manifest",
      capabilities: ["workspace"],
      description: "Buat atau edit file kode/teks",
      inputSchema: {},
      isGateway: false,
    };

    const webSearchTool: NormalizedTool = {
      fqName: "web:search",
      rawName: "search",
      origin: "custom",
      risk: "read",
      classificationProvenance: "custom-manifest",
      capabilities: ["web-search"],
      description: "Tool DEEP RESEARCH cari informasi terkini di internet",
      inputSchema: {},
      isGateway: false,
    };

    const codeKws = extractQueryKeywords("Tulis file script kode python");
    const writeScore = scoreToolForQuery(writeFileTool, codeKws);
    const webScoreOnCode = scoreToolForQuery(webSearchTool, codeKws);

    // When coding, general:write_file should receive domain boost + keyword matches
    expect(writeScore).toBeGreaterThan(750_000);
    expect(writeScore).toBeGreaterThan(webScoreOnCode);

    const researchKws = extractQueryKeywords("Riset web dan cari berita terbaru");
    const webScoreOnResearch = scoreToolForQuery(webSearchTool, researchKws);
    expect(webScoreOnResearch).toBeGreaterThan(800_000);
  });

  test("handleStepFinish anti-stall catches Indonesian preambles and nudges tool execution", () => {
    const counters = createRunCounters();
    const chatHistory: any[] = [];

    // Model says it will do something but provides no tool calls
    const res = handleStepFinish(counters, {
      stepText: "Tentu, saya bantu periksa file konfigurasi Anda terlebih dahulu.",
      stepToolCalls: [],
      stepFinishReason: "stop",
      step: 0,
      greetingOnly: false,
      providerToolsLength: 10,
      chatHistory,
    });

    expect(res.action).toBe("next");
    expect(chatHistory.length).toBe(2);
    expect(chatHistory[1].content).toContain("Anda baru menulis rencana TANPA memanggil tool");
  });

  test("guidance generators provide actionable self-correction instructions", () => {
    const writeGuidance = toolFailGuidance("TOOL_FAILED", "general:write_file");
    expect(writeGuidance).toContain("general:read_file");
    expect(writeGuidance).toContain("sha256");

    const readGuidance = toolFailGuidance("TOOL_FAILED", "general:read_file");
    expect(readGuidance).toContain("general:list_files");

    const shellGuidance = toolFailGuidance("TOOL_FAILED", "general:execute_shell");
    expect(shellGuidance).toContain("shell");

    const calGuidance = toolFailGuidance("TOOL_FAILED", "calendar:create_event");
    expect(calGuidance).toContain("RFC3339");

    const forbiddenGuidance = policyDenialGuidance("FORBIDDEN", "general:execute_shell");
    expect(forbiddenGuidance).toContain("Connectors");
  });
});
