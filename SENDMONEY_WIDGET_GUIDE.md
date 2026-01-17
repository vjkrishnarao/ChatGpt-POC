# Send Money Widget Integration Guide

## Overview

This guide explains how to use the Send Money widget with ChatGPT through the Model Context Protocol (MCP). The widget allows users to transfer money via Zelle® with amount and recipient information prefilled by ChatGPT.

## Architecture

### How It Works

1. **User Request**: User asks ChatGPT to send money (e.g., "Send $50 to Sarah")
2. **Tool Execution**: ChatGPT calls the `send_money` tool with amount and recipient parameters
3. **Server Processing**: Your MCP server receives the request and:
   - Creates a server-side draft with the transaction details
   - Returns the tool parameters in `structuredContent`
4. **Widget Loading**: ChatGPT loads the widget (HTML/React) via Skybridge
5. **Data Injection**: ChatGPT injects the tool's INPUT parameters into `window.openai.toolInput`
6. **Widget Prefill**: React reads from `window.openai.toolInput` and prefills the form
7. **User Confirmation**: User reviews and completes the transaction

## Key Components

### 1. MCP Server (`server.mjs`)

#### Send Money Tool

```javascript
server.registerTool(
  "send_money",
  {
    title: "Send Money with Zelle®",
    description: "Send money directly to a recipient using Zelle®.",
    inputSchema: z.object({
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      recipient: z.string().min(1),
    }),
    _meta: {
      "openai/outputTemplate": "ui://widget/sendmoney.html",
    },
  },
  async ({ amount, recipient }) => {
    // Create server-side draft for transaction tracking
    const { draftId, requestId } = createSendMoneyDraft(amount, recipient);
    
    // Return tool result with structuredContent
    return {
      structuredContent: {
        draftId,
        requestId,
        amount,
        recipient,
      },
      content: [{ type: "text", text: `Sending $${amount} to ${recipient}...` }],
    };
  }
);
```

#### Resource Handler

The resource handler serves the widget HTML with a fallback injection mechanism:

```javascript
server.registerResource(
  "sendmoney-ui",
  "ui://widget/sendmoney.html",
  {
    title: "Send Money with Zelle®",
    mimeType: "text/html+skybridge",
  },
  async (uri, resourceRequest) => {
    // Load widget HTML
    let sendmoneyHtml = fs.readFileSync(sendmoneyHtmlPath, "utf-8");
    
    // Inject fallback data (in case Skybridge doesn't populate toolInput)
    const latestDraft = getLatestSendMoneyDraft();
    const injectScript = `<script>
      if (!window.openai?.toolInput || Object.keys(window.openai.toolInput || {}).length === 0) {
        if (!window.openai) window.openai = {};
        window.openai.toolInput = {
          amount: '${latestDraft?.amount || ''}',
          recipient: '${latestDraft?.recipient || ''}'
        };
      }
    </script>`;
    
    sendmoneyHtml = sendmoneyHtml.replace('<body>', `<body>${injectScript}`);
    
    return {
      contents: [{ uri: uri.href, mimeType: "text/html+skybridge", text: sendmoneyHtml }],
    };
  }
);
```

### 2. React Widget (`src/sendmoney-entry.jsx`)

The entry point reads data from ChatGPT's injection:

```javascript
// Get prefill data from Skybridge's toolInput
const toolInput = window.openai?.toolInput || {};
const amount = toolInput.amount || '';
const recipient = toolInput.recipient || '';

// Start with amount entry screen if prefilled, else recipient selection
let startScreen = amount ? 'amount' : 'select';

// Render main component with prefilled data
<SendMoneyApp 
  initialAmount={amount} 
  initialRecipient={recipient}
  startScreen={startScreen}
/>
```

### 3. React Component (`src/components/SendMoneyApp.jsx`)

The main UI component that:
- Shows recipient selection screen (if not prefilled)
- Shows amount entry screen (if prefilled with recipient/amount)
- Allows user to modify values
- Displays confirmation screen
- Handles submission

## Critical Implementation Details

### Data Injection Points

**ChatGPT injects tool input parameters here:**
```javascript
window.openai.toolInput = {
  amount: "50",
  recipient: "Sarah"
}
```

**NOT here (common mistake):**
```javascript
// ❌ Don't read from toolOutput - ChatGPT doesn't populate this
window.openai.toolOutput  // This will be empty or null

// ❌ Don't expect payload - use toolInput instead
window.openai.payload  // This is not used for tool data
```

### Static Resource Template

The `outputTemplate` MUST be static (no variables):

```javascript
// ✅ Correct - static path
_meta: {
  "openai/outputTemplate": "ui://widget/sendmoney.html",
}

// ❌ Wrong - ChatGPT doesn't support variable substitution
_meta: {
  "openai/outputTemplate": "ui://widget/sendmoney.html?draftId={draftId}",
}
```

### Server-Side Draft Storage

The server stores transactions temporarily for fallback access:

```javascript
// Create a draft when tool executes
const { draftId, requestId } = createSendMoneyDraft(amount, recipient);

// Store by requestId for quick lookup
sendMoneyByRequestId.set(requestId, { amount, recipient, timestamp });

// Store as "latest" for fallback injection
sendMoneyLatestDraft = { draftId, amount, recipient, requestId };

// Auto-cleanup after 5 minutes (TTL)
const DRAFT_TTL = 5 * 60 * 1000;
```

## Using the Widget

### From ChatGPT

**User request:**
```
Send $100 to John Smith
```

**ChatGPT executes:**
```
Tool: send_money
Parameters:
  - amount: "100"
  - recipient: "John Smith"
```

**Result:**
- Widget loads with `window.openai.toolInput = { amount: "100", recipient: "John Smith" }`
- Form automatically prefills
- User reviews and confirms

### Fallback Behavior

If ChatGPT's `toolInput` injection fails:

1. Resource handler detects empty `window.openai.toolInput`
2. Injects data from server-side draft storage
3. Widget still prefills using fallback data
4. Ensures reliable prefill regardless of Skybridge behavior

## Testing

### Test Scenario 1: Full Prefill

**Command:** "Send $50 to Sarah"

**Expected Result:**
- Widget loads on "amount confirmation" screen (not recipient selection)
- Amount field shows: `50`
- Recipient field shows: `Sarah`

### Test Scenario 2: Partial Prefill

**Command:** "Send $75" (missing recipient)

**Expected Result:**
- Widget loads on "select recipient" screen
- Amount field pre-filled: `75`
- Recipient selection available

### Test Scenario 3: No Prefill

**Command:** "Open the send money form"

**Expected Result:**
- Widget loads on "select recipient" screen
- Both fields empty
- User enters all information

## Development

### Build the Widget

```bash
npm run build
```

Generates minified React bundle and serves at:
- `/public/sendmoney.html` - Minified HTML with embedded React
- `ui://widget/sendmoney.html` - Resource URI for ChatGPT

### Start the Server

```bash
npm start
```

Server runs on `http://localhost:3000`
MCP endpoint: `http://localhost:3000/mcp`

### Add to ChatGPT

1. In ChatGPT's custom GPT or via API:
   ```json
   {
     "type": "model_context_protocol",
     "url": "https://your-ngrok-url/mcp"
   }
   ```

2. The `send_money` tool becomes available to ChatGPT
3. ChatGPT can call it with any amount and recipient

## Troubleshooting

### Widget Not Prefilling

**Check 1:** Verify `window.openai.toolInput` exists
```javascript
console.log(window.openai?.toolInput);
// Should show: { amount: "...", recipient: "..." }
```

**Check 2:** Verify React reads the correct property
```javascript
// In sendmoney-entry.jsx
const toolInput = window.openai?.toolInput || {};
console.log('toolInput:', toolInput);
```

**Check 3:** Check browser console for errors
- Look for 404 on resource load
- Look for JavaScript errors in React bundle

### Empty Form After Tool Call

**Cause 1:** Server draft not created
- Check server logs for "Created draft" message

**Cause 2:** Fallback injection failed
- Verify server has draft data available
- Check server logs for "Fetched latest draft"

**Cause 3:** Script injection timing
- Fallback script runs before React initializes
- React reads `window.openai.toolInput` in entry point

### Tool Not Appearing in ChatGPT

**Check 1:** Verify MCP endpoint URL is correct
```bash
curl https://your-ngrok-url/health
# Should return: { status: "ok", ... }
```

**Check 2:** Verify tool is registered
```bash
curl https://your-ngrok-url/api/mcp-tools
# Should list "send_money" in tools array
```

**Check 3:** Check ChatGPT connector logs for MCP errors

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ ChatGPT                                                     │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ User: "Send $50 to Sarah"                            │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ├─ Calls Tool: send_money
                         │   Params: { amount: "50", recipient: "Sarah" }
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ MCP Server (Node.js)                                        │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ send_money Tool                                      │ │
│ │ ├─ Create Draft: draft_123456                        │ │
│ │ ├─ Store in sendMoneyDrafts Map                      │ │
│ │ └─ Return structuredContent                          │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ├─ Returns: { structuredContent: { ... } }
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ ChatGPT Skybridge                                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 1. Request resource: ui://widget/sendmoney.html     │ │
│ │ 2. MCP returns HTML with React bundle               │ │
│ │ 3. Inject tool input: window.openai.toolInput       │ │
│ │ 4. Load widget in iframe                            │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ React Widget (in iframe)                                    │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ sendmoney-entry.jsx                                  │ │
│ │ ├─ Read: window.openai.toolInput                     │ │
│ │ ├─ Extract: amount = "50", recipient = "Sarah"      │ │
│ │ └─ Pass to SendMoneyApp component                    │ │
│ │                                                       │ │
│ │ SendMoneyApp                                         │ │
│ │ ├─ Screen: Amount Confirmation (prefilled)          │ │
│ │ ├─ Amount: 50                                        │ │
│ │ ├─ Recipient: Sarah                                 │ │
│ │ └─ User Reviews & Confirms                           │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Files Reference

| File | Purpose |
|------|---------|
| `server.mjs` | MCP server, tool registration, resource serving |
| `src/sendmoney-entry.jsx` | React entry point, reads tool input data |
| `src/components/SendMoneyApp.jsx` | Main UI component with screens |
| `src/styles/sendmoney.css` | Widget styling |
| `public/sendmoney.html` | Built HTML served to ChatGPT |
| `webpack.config.cjs` | Build configuration |
| `package.json` | Dependencies and scripts |

## API Reference

### `send_money` Tool

**Input:**
```json
{
  "amount": "string (e.g., '50.00')",
  "recipient": "string (e.g., 'Sarah Chen')"
}
```

**Output:**
```json
{
  "structuredContent": {
    "draftId": "draft_1234567890_abc123",
    "requestId": "req_1234567890_xyz789",
    "amount": "50.00",
    "recipient": "Sarah Chen"
  },
  "content": [
    {
      "type": "text",
      "text": "Sending $50.00 to Sarah Chen..."
    }
  ]
}
```

### `prepare_send_money` Tool (Two-Step Pattern)

Prepare a transaction and get a draftId, then use `open_send_money_form` to open with that draftId.

**Input:**
```json
{
  "amount": "string",
  "recipient": "string"
}
```

**Output:**
```json
{
  "structuredContent": {
    "draftId": "draft_...",
    "requestId": "req_...",
    "amount": "...",
    "recipient": "..."
  },
  "content": [...]
}
```

## Best Practices

1. **Always return `structuredContent`** with tool parameters
2. **Use static resource templates** - no `{variable}` substitution
3. **Read from `window.openai.toolInput`** - not `payload` or `toolOutput`
4. **Implement fallback injection** for when Skybridge doesn't populate
5. **Store drafts server-side** with TTL cleanup
6. **Test with actual ChatGPT** - local testing has limitations
7. **Use descriptive tool descriptions** so ChatGPT understands when to call

## Next Steps

1. Deploy the server to a public URL (e.g., using ngrok or Heroku)
2. Add MCP endpoint to ChatGPT custom GPT or connector
3. Test tool calling from ChatGPT
4. Monitor server logs and browser console for issues
5. Refine widget UI based on user feedback

---

**Last Updated:** January 17, 2026  
**Version:** 2.0  
**Status:** Production Ready
