import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import * as z from "zod/v4";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";
import fs from "fs";

// -----------------------------
// Setup
// -----------------------------
const server = new McpServer({
  name: "form-demo-mcp",
  version: "1.0.0",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Increase limits because images happen
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Accept raw binary too (for clients that POST image/* directly)
app.use(
  express.raw({
    type: ["image/*", "application/octet-stream"],
    limit: "50mb",
  })
);

// Downloads folder
const downloadsDir = join(__dirname, "downloads");
fs.mkdirSync(downloadsDir, { recursive: true });

// In-memory session store (kept from your code)
const imageSessions = new Map();

// -----------------------------
// Helpers
// -----------------------------
function safeExtFromMime(mimeType) {
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/svg+xml": ".svg",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf",
  };
  return map[mimeType?.toLowerCase()] || "";
}

function guessMimeFromDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,/i.exec(dataUrl || "");
  return m?.[1] || null;
}

function stripDataUrlPrefix(dataUrl) {
  return (dataUrl || "").replace(/^data:[^;]+;base64,/i, "");
}

function isProbablyBase64(s) {
  if (typeof s !== "string") return false;
  const trimmed = s.trim();
  if (!trimmed) return false;
  // allow data URLs elsewhere, but this checks raw base64-ish strings
  if (trimmed.startsWith("data:")) return true;
  // base64 chars + padding, not too strict
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 32;
}

function randomId(prefix = "img") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeFilename(name) {
  return (name || "")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

/**
 * Normalize any "ChatGPT image input" into:
 * { buffer: Buffer, mimeType: string, filename: string }
 *
 * Supported inputs:
 * - JSON: { imageData: "data:image/png;base64,..." }
 * - JSON: { imageData: "<raw base64>", mimeType?: "...", filename?: "..." }
 * - raw binary body: Content-Type image/* or octet-stream
 */
function normalizeIncomingImage(req, body = {}) {
  // 1) Raw binary body
  if (Buffer.isBuffer(req.body) && req.body.length) {
    const mimeType =
      req.headers["content-type"]?.split(";")[0]?.trim() || "application/octet-stream";
    const ext = safeExtFromMime(mimeType) || "";
    const filename = sanitizeFilename(body.filename || "raw_upload");
    return {
      buffer: req.body,
      mimeType,
      filename: `${filename}${ext || ""}`,
    };
  }

  // 3) JSON/base64/data-url
  const imageData = body.imageData ?? body.data ?? body.base64 ?? null;
  const mimeTypeFromBody = body.mimeType ?? body.contentType ?? null;
  const filenameFromBody = body.filename ?? body.name ?? null;

  if (typeof imageData === "string" && imageData.trim()) {
    let mimeType = mimeTypeFromBody;

    if (imageData.trim().startsWith("data:")) {
      mimeType = mimeType || guessMimeFromDataUrl(imageData) || "application/octet-stream";
      const b64 = stripDataUrlPrefix(imageData);
      return {
        buffer: Buffer.from(b64, "base64"),
        mimeType,
        filename: sanitizeFilename(filenameFromBody || "chatgpt_image") + (safeExtFromMime(mimeType) || ""),
      };
    }

    if (isProbablyBase64(imageData)) {
      mimeType = mimeType || "application/octet-stream";
      return {
        buffer: Buffer.from(imageData.trim(), "base64"),
        mimeType,
        filename: sanitizeFilename(filenameFromBody || "chatgpt_image") + (safeExtFromMime(mimeType) || ""),
      };
    }
  }

  throw new Error(
    "No valid image found. Send raw image bytes or JSON { imageData: dataURL|base64 }."
  );
}

function toDataUrl(buffer, mimeType) {
  const b64 = buffer.toString("base64");
  return `data:${mimeType || "application/octet-stream"};base64,${b64}`;
}

async function postToRemote(remoteUrl, payload) {
  const resp = await fetch(remoteUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!resp.ok) {
    const msg = parsed?.error || parsed?.message || text || "Remote upload failed";
    throw new Error(`Remote POST failed (${resp.status}): ${msg}`);
  }

  return parsed;
}

// -----------------------------
// Ngrok URL discovery (kept)
// -----------------------------
const getNgrokUrl = async () => {
  try {
    const response = await fetch("http://localhost:4040/api/tunnels");
    const data = await response.json();
    if (data.tunnels && data.tunnels.length > 0) {
      return data.tunnels[0].public_url;
    }
  } catch (error) {
    console.warn("⚠️  Could not fetch ngrok URL:", error.message);
  }
  return "http://localhost:3000";
};

let cachedNgrokUrl = "http://localhost:3000";
const updateNgrokUrl = async () => {
  cachedNgrokUrl = await getNgrokUrl();
  console.log(`📍 Using image server URL: ${cachedNgrokUrl}`);
};
updateNgrokUrl();
setInterval(updateNgrokUrl, 30000);

// -----------------------------
// Resource: Application Form UI (kept)
// -----------------------------
server.registerResource(
  "application-form-ui",
  "ui://widget/application-form.html",
  {
    title: "Application Form UI",
    description: "Embedded widget to capture basic user details using a form.",
    mimeType: "text/html+skybridge",
  },
  async (uri) => {
    const formHtmlPath = join(__dirname, "public", "credit-card-form.html");
    let formHtml = "";

    try {
      formHtml = fs.readFileSync(formHtmlPath, "utf-8");
    } catch (error) {
      console.error("Failed to read form HTML:", error);
      formHtml = "<h1>Error loading form</h1>";
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: formHtml,
        },
      ],
    };
  }
);

// -----------------------------
// Tools: (your existing tools kept)
// -----------------------------
server.registerTool(
  "open_application_form",
  {
    title: "Open Application Form",
    description:
      "Opens an embedded application form widget and optionally pre-fills user details.",
    inputSchema: z.object({
      formType: z.enum(["rewards", "cashback", "travel", "premium", "student"]).optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      address: z.string().optional(),
      zipCode: z.string().optional(),
      annualIncome: z.number().optional(),
      employmentStatus: z
        .enum(["employed", "self-employed", "retired", "student", "other"])
        .optional(),
    }),
    _meta: {
      "openai/outputTemplate": "ui://widget/application-form.html",
      "openai/toolInvocation/invoking": "Opening application form...",
      "openai/toolInvocation/invoked":
        "Application form is ready. You can review and edit the details.",
    },
  },
  async (params) => {
    const prefillData = {
      formType: params.formType || null,
      firstName: params.firstName || null,
      lastName: params.lastName || null,
      email: params.email || null,
      phone: params.phone || null,
      country: params.country || "United States",
      city: params.city || null,
      state: params.state || null,
      address: params.address || null,
      zipCode: params.zipCode || null,
      annualIncome: params.annualIncome || null,
      employmentStatus: params.employmentStatus || null,
    };

    return {
      structuredContent: prefillData,
      content: [
        {
          type: "text",
          text: `Opened the application form${
            params.formType ? ` for ${params.formType}` : ""
          }. Details will be prefilled when available.`,
        },
      ],
    };
  }
);

server.registerTool(
  "get_account_details",
  {
    title: "Get Account Details",
    description:
      "Retrieves mock banking account details including account number, routing number, and account type.",
    inputSchema: z.object({
      accountId: z.string().optional(),
    }),
  },
  async () => {
    const mockAccount = {
      accountNumber: "9876543210",
      routingNumber: "021000021",
      accountType: "Checking",
      accountHolderName: "John Doe",
      balance: 5250.75,
      currency: "USD",
      status: "Active",
      openedDate: "2024-01-15",
      bankName: "Premier Bank",
      SWIFT: "PNBAUS33",
      IBAN: "US12021000021987654321",
    };

    return {
      content: [
        {
          type: "text",
          text: `✅ Account Details Retrieved:\n\n**Account Information:**\n- Account Number: ${mockAccount.accountNumber}\n- Routing Number: ${mockAccount.routingNumber}\n- Account Type: ${mockAccount.accountType}\n- Account Holder: ${mockAccount.accountHolderName}\n- Bank Name: ${mockAccount.bankName}\n- Status: ${mockAccount.status}\n\n**Account Identifiers:**\n- SWIFT Code: ${mockAccount.SWIFT}\n- IBAN: ${mockAccount.IBAN}\n\n**Balance:**\n- Current Balance: $${mockAccount.balance.toFixed(
            2
          )} ${mockAccount.currency}`,
        },
      ],
    };
  }
);

server.registerTool(
  "get_credit_card_transactions",
  {
    title: "Get Credit Card Transactions",
    description: "Retrieves mock credit card transaction history for the last 30 days.",
    inputSchema: z.object({
      cardLastFour: z.string().optional(),
      limit: z.number().optional().default(10),
    }),
  },
  async (params) => {
    const mockTransactions = [
      { date: "2024-11-28", merchant: "Amazon Prime Video", category: "Entertainment", amount: 14.99, status: "Completed" },
      { date: "2024-11-27", merchant: "Whole Foods Market", category: "Groceries", amount: 87.43, status: "Completed" },
      { date: "2024-11-26", merchant: "Shell Gas Station", category: "Gas & Fuel", amount: 52.15, status: "Completed" },
      { date: "2024-11-25", merchant: "Nike Store", category: "Shopping", amount: 129.99, status: "Completed" },
      { date: "2024-11-24", merchant: "Starbucks Coffee", category: "Food & Drink", amount: 5.47, status: "Completed" },
      { date: "2024-11-23", merchant: "United Airlines", category: "Travel", amount: 456.0, status: "Completed" },
      { date: "2024-11-22", merchant: "Netflix", category: "Entertainment", amount: 15.99, status: "Completed" },
      { date: "2024-11-21", merchant: "CVS Pharmacy", category: "Health & Medical", amount: 24.56, status: "Completed" },
      { date: "2024-11-20", merchant: "Best Buy", category: "Electronics", amount: 299.99, status: "Completed" },
      { date: "2024-11-19", merchant: "The Cheesecake Factory", category: "Dining", amount: 78.35, status: "Completed" },
    ];

    const limit = Math.min(params.limit || 10, mockTransactions.length);
    const transactions = mockTransactions.slice(0, limit);
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    let transactionText = `💳 **Credit Card Transactions** (Last ${limit} transactions)\n\n`;
    transactions.forEach((t, idx) => {
      transactionText += `${idx + 1}. **${t.merchant}** (${t.category})\n   Date: ${
        t.date
      } | Amount: $${t.amount.toFixed(2)} | Status: ${t.status}\n\n`;
    });
    transactionText += `**Total: $${totalAmount.toFixed(2)}**`;

    return { content: [{ type: "text", text: transactionText }] };
  }
);

server.registerTool(
  "get_banking_info_summary",
  {
    title: "Get Banking Information Summary",
    description:
      "Provides a comprehensive summary of routing number, account number, and related banking details.",
    inputSchema: z.object({
      includeTransactions: z.boolean().optional().default(false),
    }),
  },
  async (params) => {
    const accountInfo = {
      accountNumber: "9876543210",
      routingNumber: "021000021",
      accountType: "Premium Checking",
      bankName: "Premier Bank",
      swiftCode: "PNBAUS33",
      accountHolderName: "John Doe",
      accountStatus: "Active",
      overdraftProtection: "Enabled",
      monthlyFee: 0,
      interestRate: "0.15%",
      minimumBalance: 1000,
    };

    let summaryText = `🏦 **Banking Information Summary**\n\n`;
    summaryText += `**Bank Details:**\n`;
    summaryText += `- Bank Name: ${accountInfo.bankName}\n`;
    summaryText += `- Routing Number: **${accountInfo.routingNumber}**\n`;
    summaryText += `- Account Number: **${accountInfo.accountNumber}**\n`;
    summaryText += `- SWIFT Code: ${accountInfo.swiftCode}\n\n`;

    summaryText += `**Account Information:**\n`;
    summaryText += `- Account Type: ${accountInfo.accountType}\n`;
    summaryText += `- Account Holder: ${accountInfo.accountHolderName}\n`;
    summaryText += `- Status: ${accountInfo.accountStatus}\n`;
    summaryText += `- Overdraft Protection: ${accountInfo.overdraftProtection}\n\n`;

    summaryText += `**Account Features:**\n`;
    summaryText += `- Monthly Fee: ${accountInfo.monthlyFee === 0 ? "Free" : `$${accountInfo.monthlyFee}`}\n`;
    summaryText += `- Interest Rate: ${accountInfo.interestRate}\n`;
    summaryText += `- Minimum Balance: $${accountInfo.minimumBalance.toFixed(2)}\n`;

    if (params.includeTransactions) {
      summaryText += `\n**Recent Transactions:**\n`;
      summaryText += `Last 5 transactions available. Use 'get_credit_card_transactions' for full history.\n`;
    }

    return { content: [{ type: "text", text: summaryText }] };
  }
);

// -----------------------------
// Minimal security headers
// -----------------------------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// -----------------------------
// MCP Endpoint
// -----------------------------
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    res.on("close", () => transport.close());

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal MCP server error" });
  }
});

// -----------------------------
// Your existing /api/form-submit, mock banking endpoints, etc.
// (kept, trimmed for sanity: keep your existing blocks if you want)
// -----------------------------

app.post("/api/form-submit", async (req, res) => {
  try {
    const data = req.body;

    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "formType",
      "annualIncome",
      "employmentStatus",
      "address",
      "city",
      "state",
      "zipCode",
      "country",
    ];

    const missingFields = requiredFields.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (typeof data.annualIncome !== "number" || data.annualIncome < 0) {
      return res.status(400).json({ error: "Annual income must be a positive number" });
    }

    const record = {
      id: `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      status: "received",
      processedAt: new Date().toISOString(),
      ipAddress: req.ip,
    };

    console.log("📨 Application received:", {
      id: record.id,
      name: `${data.firstName} ${data.lastName}`,
      type: data.formType,
      email: data.email,
      timestamp: record.processedAt,
    });

    res.status(200).json({
      success: true,
      message: "Form submitted successfully",
      applicationId: record.id,
    });
  } catch (error) {
    console.error("Error processing application:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// -----------------------------
// NEW: /api/chat-gpt-image mock endpoint
// Stores received image in ./downloads
// Supports:
// - JSON { imageData: dataURL|base64, filename?, mimeType? }
// - raw binary body (Content-Type image/*)
// -----------------------------
app.post("/api/chat-gpt-image", async (req, res) => {
  try {
    const normalized = normalizeIncomingImage(req, req.body || {});

    const ext =
      extname(normalized.filename) ||
      safeExtFromMime(normalized.mimeType) ||
      ".bin";

    const baseName = sanitizeFilename(normalized.filename.replace(extname(normalized.filename), "")) || "chatgpt_image";
    const outName = `${baseName}-${Date.now()}${ext}`;
    const outPath = join(downloadsDir, outName);

    fs.writeFileSync(outPath, normalized.buffer);

    res.json({
      success: true,
      savedAs: outName,
      savedPath: outPath,
      bytes: normalized.buffer.length,
      mimeType: normalized.mimeType,
    });
  } catch (err) {
    console.error("❌ /api/chat-gpt-image error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Optional: endpoint to list downloads
app.get("/api/chat-gpt-image/downloads", (req, res) => {
  const files = fs
    .readdirSync(downloadsDir)
    .filter((f) => !f.startsWith("."))
    .map((f) => ({
      filename: f,
      path: join(downloadsDir, f),
      size: fs.statSync(join(downloadsDir, f)).size,
    }));
  res.json({ count: files.length, files });
});

// Debug endpoint for sessions (kept)
app.get("/api/debug-sessions", (req, res) => {
  const sessions = Array.from(imageSessions.entries()).map(([sessionId, session]) => ({
    sessionId,
    title: session.title,
    dataLength: session.data ? session.data.length : 0,
    dataStart: session.data ? session.data.substring(0, 80) : null,
    uploadedAt: session.uploadedAt,
    mimeType: session.mimeType,
  }));

  res.json({
    totalSessions: sessions.length,
    sessions,
  });
});

// Static files + health
app.use(express.static(join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "form-demo-mcp",
    version: "1.0.0",
    endpoints: {
      mcp: "/mcp",
      formApi: "/api/form-submit",
      imageApi: "/api/chat-gpt-image",
      downloads: "/api/chat-gpt-image/downloads",
      debugSessions: "/api/debug-sessions",
    },
    downloadsDir,
    publicUrlGuess: cachedNgrokUrl,
  });
});

// Startup
const port = process.env.PORT || 3000;
app
  .listen(port, () => {
    console.log(`🧩 Form Demo MCP Server running at http://localhost:${port}`);
    console.log(`📍 MCP Endpoint: http://localhost:${port}/mcp`);
    console.log(`🖼️  Image Endpoint: http://localhost:${port}/api/chat-gpt-image`);
    console.log(`📁 Downloads folder: ${downloadsDir}`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });