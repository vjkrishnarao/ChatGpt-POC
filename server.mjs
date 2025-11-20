import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import * as z from "zod/v4";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const server = new McpServer({
  name: "form-demo-mcp",
  version: "1.0.0",
});

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 1) HTML widget resource for a generic application form
 */
server.registerResource(
  "application-form-ui",
  "ui://widget/application-form.html",
  {
    title: "Application Form UI",
    description: "Embedded widget to capture basic user details using a form.",
    mimeType: "text/html+skybridge",
  },
  async uri => {
    const formHtmlPath = join(__dirname, "public", "credit-card-form.html"); // keep your existing file
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

/**
 * 2) Tool that opens the embedded application form
 */
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
      "openai/toolInvocation/invoked": "Application form is ready. You can review and edit the details.",
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

/**
 * 3) Express app setup with minimal headers and endpoints
 */
const app = express();
app.use(express.json());

// ============================================
// Security Headers & Middleware (minimal)
// ============================================

app.use((req, res, next) => {
  // Basic security headers only; rely on ChatGPT sandbox for iframe isolation
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// No global CORS. The MCP endpoint is used server-to-server by ChatGPT.
// If your form in HTML calls the API from the browser, you can add
// very limited CORS only for that endpoint:
app.use("/api/form-submit", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, ");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-From");
    return res.sendStatus(200);
  }
  next();
});

// ============================================
// MCP Endpoint
// ============================================

app.options("/api/form-submit", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, ");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error" });
    }
  }
});

// ============================================
// Generic Application Submission Endpoint
// ============================================

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

    const missingFields = requiredFields.filter(field => !data[field]);
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

// ============================================
// Static files
// ============================================

app.use(express.static(join(__dirname, "public")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "form-demo-mcp",
    version: "1.0.0",
    endpoints: {
      mcp: "/mcp",
      formApi: "/api/form-submit",
      form: "/credit-card-form.html",
    },
  });
});

// ============================================
// Server startup
// ============================================

const port = process.env.PORT || 3000;
app
  .listen(port, () => {
    console.log(`🧩 Form Demo MCP Server running at http://localhost:${port}`);
    console.log(`📍 MCP Endpoint: http://localhost:${port}/mcp`);
    console.log(`📋 Health Check: http://localhost:${port}/health`);
    console.log(`📝 Form: http://localhost:${port}/credit-card-form.html`);
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
