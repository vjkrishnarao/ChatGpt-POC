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

// CRITICAL: Disable all caching for development
app.use((req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate, public, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("ETag", false);
  next();
});

// Downloads folder
const downloadsDir = join(__dirname, "downloads");
fs.mkdirSync(downloadsDir, { recursive: true });

// In-memory session store (kept from your code)
const imageSessions = new Map();

// Draft storage for send-money (two-step pattern)
const sendMoneyDrafts = new Map(); // key: draftId, value: { amount, recipient, createdAt, requestId }
const sendMoneyLatestDraft = {}; // Keep track of the most recent draft for fallback
const sendMoneyByRequestId = new Map(); // key: requestId, value: { amount, recipient, timestamp }
const DRAFT_TTL = 5 * 60 * 1000; // 5 minutes

// Helper: Create a new draft
function createSendMoneyDraft(amount, recipient) {
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const draft = {
    amount: String(amount).trim(),
    recipient: String(recipient).trim(),
    createdAt: Date.now(),
    requestId,
  };
  sendMoneyDrafts.set(draftId, draft);
  
  // CRITICAL: Store by requestId so resource handler can find it quickly
  // This is the key to the solution - requestId is returned in tool response
  sendMoneyByRequestId.set(requestId, {
    amount: draft.amount,
    recipient: draft.recipient,
    timestamp: Date.now(),
  });
  
  // Also store as "latest" - resource handler will use this as fallback
  sendMoneyLatestDraft.draftId = draftId;
  sendMoneyLatestDraft.amount = draft.amount;
  sendMoneyLatestDraft.recipient = draft.recipient;
  sendMoneyLatestDraft.timestamp = draft.createdAt;
  sendMoneyLatestDraft.requestId = requestId;
  
  console.log('💾 Created draft:', { draftId, requestId, amount: draft.amount, recipient: draft.recipient });
  
  // Clean up old entries
  const now = Date.now();
  for (const [key, val] of sendMoneyByRequestId.entries()) {
    if (now - val.timestamp > DRAFT_TTL) {
      sendMoneyByRequestId.delete(key);
    }
  }
  for (const [key, val] of sendMoneyDrafts.entries()) {
    if (now - val.createdAt > DRAFT_TTL) {
      sendMoneyDrafts.delete(key);
    }
  }
  
  return { draftId, requestId };
}

// Helper: Retrieve and validate draft
function getSendMoneyDraft(draftId) {
  const draft = sendMoneyDrafts.get(draftId);
  if (!draft) {
    console.log('❌ Draft not found:', draftId);
    return null;
  }
  
  // Check if expired
  if (Date.now() - draft.createdAt > DRAFT_TTL) {
    console.log('❌ Draft expired:', draftId);
    sendMoneyDrafts.delete(draftId);
    return null;
  }
  
  console.log('✅ Retrieved draft:', { draftId, amount: draft.amount, recipient: draft.recipient });
  return draft;
}

// Helper: Get draft by requestId
function getSendMoneyByRequestId(requestId) {
  const data = sendMoneyByRequestId.get(requestId);
  if (!data) {
    return null;
  }
  if (Date.now() - data.timestamp > DRAFT_TTL) {
    sendMoneyByRequestId.delete(requestId);
    return null;
  }
  console.log('✅ Retrieved by requestId:', requestId);
  return data;
}

// Helper: Get the latest draft (for resource handler fallback)
function getLatestSendMoneyDraft() {
  if (sendMoneyLatestDraft.requestId && Date.now() - sendMoneyLatestDraft.timestamp < DRAFT_TTL) {
    console.log('✅ Using latest draft:', { amount: sendMoneyLatestDraft.amount, recipient: sendMoneyLatestDraft.recipient });
    return {
      amount: sendMoneyLatestDraft.amount,
      recipient: sendMoneyLatestDraft.recipient,
    };
  }
  console.log('❌ No valid latest draft available');
  return null;
}

// Session/Draft storage for send-money (old pattern, kept for backward compat)
const sendMoneyStore = new Map();
let sessionCounter = 0;

// NOTE:
// ChatGPT's UI rendering expects a *static* outputTemplate declared on the tool.
// Returning a dynamic outputTemplate at runtime (for example with ?session=...)
// is not reliably honored by the client, which is why you were seeing nothing
// render.
//
// Fix approach:
// - Declare a static outputTemplate on the tool: ui://widget/sendmoney.html
// - Pass the prefill data via structuredContent and also stash a "latest" copy
//   in memory as a fallback.
// - The resource handler reads (in order): explicit session -> latest -> query.

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

// Try to extract { amount, recipient } from a nested resourceRequest object
function extractAmountRecipientFromResourceRequest(resourceRequest) {
  if (!resourceRequest || typeof resourceRequest !== "object") return null;

  let found = null;

  function walk(node) {
    if (!node || typeof node !== "object" || found) return;

    // Direct hit on this object
    if (typeof node.amount === "string" && node.amount.trim()) {
      found = {
        amount: node.amount.trim(),
        recipient:
          typeof node.recipient === "string" ? node.recipient.trim() : "",
      };
      return;
    }

    for (const key of Object.keys(node)) {
      const value = node[key];
      if (value && typeof value === "object") {
        walk(value);
      }
    }
  }

  try {
    walk(resourceRequest);
  } catch (e) {
    console.warn("⚠️  Failed to walk resourceRequest for amount/recipient:", e);
  }

  return found;
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
  "get_cashback_cards",
  {
    title: "Get Cashback Credit Cards",
    description:
      "Shows available credit cards with cashback rewards. Use this tool when user asks about cashback cards, cash rewards cards, or wants to see card options.",
    inputSchema: z.object({}),
    _meta: {
      "openai/outputTemplate": "ui://widget/cashback-cards.html",
      "openai/toolInvocation/invoking": "Loading cashback credit cards...",
      "openai/toolInvocation/invoked":
        "Here are the available cashback credit cards. You can review the options and learn more about each card.",
    },
  },
  async () => {
    const cardsHtmlPath = join(__dirname, "public", "cards.html");
    let cardsHtml = "";

    try {
      cardsHtml = fs.readFileSync(cardsHtmlPath, "utf-8");
    } catch (error) {
      console.error("Failed to read cards HTML:", error);
      cardsHtml = "<h1>Error loading credit cards</h1>";
    }

    return {
      content: [
        {
          type: "text",
          text: "Here are the available cashback credit cards:\n\n1. **Active Cash® Card** - Earn unlimited 2% cash rewards on purchases\n2. **Reflect® Card** - Low intro APR for 21 months from account opening\n3. **Autograph® Card** - Earn 3X points for many ways to keep life in motion",
        },
      ],
    };
  }
);

server.registerResource(
  "cashback-cards-ui",
  "ui://widget/cashback-cards.html",
  {
    title: "Cashback Credit Cards",
    description: "Interactive widget showing available cashback credit cards with details and application options.",
    mimeType: "text/html+skybridge",
  },
  async (uri) => {
    const cardsHtmlPath = join(__dirname, "public", "cards.html");
    let cardsHtml = "";

    try {
      cardsHtml = fs.readFileSync(cardsHtmlPath, "utf-8");
    } catch (error) {
      console.error("Failed to read cards HTML:", error);
      cardsHtml = "<h1>Error loading credit cards</h1>";
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: cardsHtml,
        },
      ],
    };
  }
);


// NEW PATTERN: Step 1 - Prepare/confirm the send money (store draft server-side)
server.registerTool(
  "prepare_send_money",
  {
    title: "Prepare Send Money",
    description:
      "Prepare a send money request with amount and recipient. Returns a draftId to use with open_send_money_form.",
    inputSchema: z.object({
      amount: z.string().min(1).regex(/^\d+(\.\d{1,2})?$/).describe("Dollar amount to send (e.g., '10.50')"),
      recipient: z.string().min(1).describe("Recipient name (required)"),
    }),
  },
  async ({ amount, recipient }) => {
    console.log('\n========== PREPARE_SEND_MONEY TOOL CALLED ==========');
    console.log('💰 Amount:', amount);
    console.log('👤 Recipient:', recipient);
    
    if (!amount || !recipient) {
      console.log('❌ Missing required fields');
      return {
        content: [
          {
            type: "text",
            text: "Error: both amount and recipient are required. Please provide both before proceeding.",
          },
        ],
      };
    }
    
    const { draftId, requestId } = createSendMoneyDraft(amount, recipient);
    
    console.log('✅ Draft prepared:', draftId);
    console.log('========== END PREPARE_SEND_MONEY ==========\n');
    
    return {
      structuredContent: {
        draftId,
        requestId,
        amount,
        recipient,
      },
      content: [
        {
          type: "text",
          text: `Prepared send money request: $${amount} to ${recipient}. Draft ID: ${draftId}`,
        },
      ],
    };
  }
);

// NEW PATTERN: Step 2 - Open the send money form (fetch draft and prefill)
server.registerTool(
  "open_send_money_form",
  {
    title: "Open Send Money Form",
    description:
      "Open the Zelle® money transfer form for a previously prepared send money request.",
    inputSchema: z.object({
      draftId: z.string().min(1).describe("The draft ID returned from prepare_send_money"),
    }),
    _meta: {
      // CRITICAL: Use STATIC template WITHOUT template variables
      // ChatGPT's connector does NOT support {variable} substitution
      "openai/outputTemplate": "ui://widget/sendmoney.html",
    },
  },
  async ({ draftId }) => {
    console.log('\n========== OPEN_SEND_MONEY_FORM TOOL CALLED ==========');
    console.log('📋 draftId:', draftId);
    
    const draft = getSendMoneyDraft(draftId);
    if (!draft) {
      console.log('❌ Draft not found or expired');
      return {
        content: [
          {
            type: "text",
            text: "Error: draft not found or expired. Please prepare the send money request again.",
          },
        ],
      };
    }
    
    // CRITICAL: Also store as "latest" so resource handler can find it
    sendMoneyLatestDraft.draftId = draftId;
    sendMoneyLatestDraft.amount = draft.amount;
    sendMoneyLatestDraft.recipient = draft.recipient;
    sendMoneyLatestDraft.timestamp = draft.createdAt;
    console.log('💾 Stored draft as "latest":', { amount: draft.amount, recipient: draft.recipient });
    
    console.log('✅ Opening form with draft data');
    console.log('========== END OPEN_SEND_MONEY_FORM ==========\n');
    
    return {
      structuredContent: {
        draftId,
        amount: draft.amount,
        recipient: draft.recipient,
      },
      content: [
        {
          type: "text",
          text: `Opening money transfer form for $${draft.amount} to ${draft.recipient}...`,
        },
      ],
    };
  }
);

// ENHANCED: Smart send_money tool with optional parameters
// Handles partial input: amount-only, recipient-only, or both
// Uses STATIC outputTemplate - NO template variables
// Stores draft server-side with smart screen selection
server.registerTool(
  "send_money",
  {
    title: "Send Money with Zelle®",
    description:
      "Send money to a recipient using Zelle®. Can specify amount, recipient, or both. Opens form with smart prefill and screen selection.",
    inputSchema: z.object({
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Dollar amount format (e.g., '50.00')").optional().describe("Dollar amount to send (e.g., '50.00', '10.50') - optional"),
      recipient: z.string().optional().describe("Recipient name (e.g., 'David' or 'Sarah Chen') - optional"),
    }),
    _meta: {
      // CRITICAL: Use STATIC template WITHOUT template variables
      // ChatGPT's connector does NOT support {variable} substitution in outputTemplate
      "openai/outputTemplate": "ui://widget/sendmoney.html",
    },
  },
  async ({ amount, recipient }) => {
    console.log('\n========== SEND_MONEY TOOL CALLED ==========');
    console.log('💰 Amount:', amount || '(not provided)');
    console.log('👤 Recipient:', recipient || '(not provided)');
    
    // Determine what was provided
    const hasAmount = Boolean(amount && amount.trim());
    const hasRecipient = Boolean(recipient && recipient.trim());
    
    // Determine start screen based on what was provided
    let startScreen = 'select'; // default
    if (hasAmount && !hasRecipient) {
      startScreen = 'select'; // User said "send $50" → show recipient selection first
      console.log('📋 Amount provided, no recipient → start on recipient selection');
    } else if (hasRecipient && !hasAmount) {
      startScreen = 'amount'; // User said "send to Sarah" → show amount entry
      console.log('📋 Recipient provided, no amount → start on amount entry');
    } else if (hasAmount && hasRecipient) {
      startScreen = 'amount'; // Both provided → show confirmation screen
      console.log('📋 Both provided → start on confirmation');
    } else {
      startScreen = 'select'; // Neither provided → show recipient selection
      console.log('📋 Neither provided → start on recipient selection (blank form)');
    }
    
    // Create draft (even if partial) so we can prefill the form
    // The frontend will handle partial data gracefully
    const { draftId, requestId } = createSendMoneyDraft(
      amount || '',
      recipient || ''
    );
    
    console.log('✅ Created draft:', draftId);
    console.log('✅ Start screen:', startScreen);
    console.log('========== END SEND_MONEY ==========\n');
    
    // Return structured data with startScreen hint
    return {
      structuredContent: {
        draftId,
        requestId,
        amount: amount || '',
        recipient: recipient || '',
        startScreen, // Hint for the widget about which screen to show
      },
      content: [
        {
          type: "text",
          text: hasAmount && hasRecipient
            ? `Sending $${amount} to ${recipient}...`
            : hasAmount
            ? `Ready to send $${amount}. Select a recipient.`
            : hasRecipient
            ? `Ready to send to ${recipient}. Enter amount.`
            : `Opening money transfer form. Enter recipient and amount.`,
        },
      ],
    };
  }
);

// NEW: Open blank send money form (no prefill)
// User can enter amount and recipient manually
server.registerTool(
  "open_blank_send_money_form",
  {
    title: "Open Send Money Form",
    description:
      "Open the Zelle® money transfer form with blank fields. User enters amount and recipient manually.",
    inputSchema: z.object({}), // No required inputs
    _meta: {
      "openai/outputTemplate": "ui://widget/sendmoney.html",
    },
  },
  async () => {
    console.log('\n========== OPEN_BLANK_SEND_MONEY_FORM TOOL CALLED ==========');
    
    // Don't create a draft - let the user fill in the form
    console.log('✅ Opening blank send money form');
    console.log('========== END OPEN_BLANK_SEND_MONEY_FORM ==========\n');
    
    return {
      structuredContent: {
        // No prefill data
      },
      content: [
        {
          type: "text",
          text: "Opening money transfer form. Enter the amount and recipient to proceed.",
        },
      ],
    };
  }
);

server.registerResource(
  "sendmoney-ui",
  "ui://widget/sendmoney.html",
  {
    title: "Send Money with Zelle®",
    description: "Interactive money transfer interface using Zelle®.",
    mimeType: "text/html+skybridge",
  },
  async (uri, resourceRequest) => {
    console.log('\n========== SENDMONEY RESOURCE HANDLER CALLED ==========');
    console.log('⏰ Resource timestamp:', new Date().toISOString());
    console.log('📍 Full URI:', uri.href);
    
    const sendmoneyHtmlPath = join(__dirname, "public", "sendmoney.html");
    let sendmoneyHtml = "";

    try {
      sendmoneyHtml = fs.readFileSync(sendmoneyHtmlPath, "utf-8");
      
      // FALLBACK: Since window.openai.toolOutput isn't being populated by Skybridge,
      // we inject the latest draft data as a fallback
      const latestDraft = getLatestSendMoneyDraft();
      const amount = latestDraft?.amount || '';
      const recipient = latestDraft?.recipient || '';
      
      console.log('📊 Fetched latest draft for fallback:', { amount, recipient });
      
      // Inject into window.openai.toolOutput as fallback if it's empty
      const injectScript = `<script>
        // Fallback: If Skybridge didn't populate toolOutput, use the draft data
        if (!window.openai?.toolOutput || Object.keys(window.openai.toolOutput || {}).length === 0) {
          if (!window.openai) window.openai = {};
          window.openai.toolOutput = {
            amount: '${amount.replace(/'/g, "\\'")}',
            recipient: '${recipient.replace(/'/g, "\\'")}'
          };
          console.log('✅ Fallback: Injected toolOutput from server-side draft:', window.openai.toolOutput);
        } else {
          console.log('✅ Skybridge populated toolOutput, using that:', window.openai.toolOutput);
        }
      </script>`;
      
      // Insert the script right after <body> but before the React root
      sendmoneyHtml = sendmoneyHtml.replace('<body>', `<body>${injectScript}`);
      
      console.log('✅ HTML loaded with fallback injection');
      console.log('========== END RESOURCE HANDLER ==========\n');
    } catch (error) {
      console.error("❌ Failed to read sendmoney HTML:", error);
      sendmoneyHtml = "<h1>Error loading money transfer interface</h1>";
      console.log('========== END RESOURCE HANDLER (ERROR) ==========\n');
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: sendmoneyHtml,
        },
      ],
    };
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

// DEBUG: Health check endpoint to verify tools are registered
app.get("/api/mcp-status", (req, res) => {
  res.json({
    status: "online",
    mcp_server: "form-demo-mcp",
    timestamp: new Date().toISOString(),
    note: "Tools registered at startup and re-advertised on each MCP connection"
  });
});

// DEBUG: List registered tools (for diagnostics only)
app.get("/api/mcp-tools", (req, res) => {
  // MCP SDK doesn't expose registered tools directly, so this is informational
  res.json({
    info: "Tools registered via McpServer.registerTool()",
    tools: [
      "send_money",
      "open_send_money_form",
      "open_blank_send_money_form",
      "prepare_send_money",
      "open_application_form",
      "upload_image",
      "get_credit_card_transactions",
      "get_cashback_cards"
    ],
    note: "For full details, query via /mcp with tools/list method"
  });
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

// NEW: Get latest send-money parameters (for client-side polling as fallback)
app.get("/api/sendmoney-latest", (req, res) => {
  const latest = getLatestSendMoneyDraft();
  res.json({
    amount: latest?.amount || '',
    recipient: latest?.recipient || '',
    timestamp: latest?.timestamp || null,
    hasData: !!(latest?.amount || latest?.recipient),
  });
});

// Static files + health
app.use(express.static(join(__dirname, "public")));

// Route for sendmoney page (single build serves both)
app.get("/sendmoney.html", (req, res) => {
  res.sendFile(join(__dirname, "public", "sendmoney.html"));
});

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
      cards: "/cards.html",
      sendMoney: "/sendmoney.html"
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