# Model Context Protocol (MCP) Tools Documentation

Complete guide for all tools available in the ChatGPT POC MCP server.

---

## Table of Contents

1. [Send Money Tool](#send-money-tool)
2. [Prepare Send Money Tool](#prepare-send-money-tool)
3. [Open Send Money Form Tool](#open-send-money-form-tool)
4. [Open Application Form Tool](#open-application-form-tool)
5. [Get Credit Card Transactions Tool](#get-credit-card-transactions-tool)
6. [Get Cashback Cards Tool](#get-cashback-cards-tool)
7. [Upload Image Tool](#upload-image-tool)

---

## Send Money Tool

### Overview
Send money directly to a recipient using Zelle® with prefilled amount and recipient information.

### Tool ID
`send_money`

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `amount` | string | Yes | Dollar amount to send (format: `\d+(\.\d{1,2})?`) | `"50.00"`, `"100"` |
| `recipient` | string | Yes | Recipient name or identifier | `"Sarah Chen"`, `"John"` |

### Input Schema
```json
{
  "amount": "string (regex: ^\\d+(\\.\\d{1,2})?$)",
  "recipient": "string (min length: 1)"
}
```

### Output
Returns widget display with prefilled transaction data:

```json
{
  "structuredContent": {
    "draftId": "draft_1768671503643_3ou0gjetr",
    "requestId": "req_1768671503643_qyqionpuq",
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

### Widget Display
- **Template**: Static HTML/React widget
- **Resource URI**: `ui://widget/sendmoney.html`
- **Screens**:
  1. If prefilled with amount: Shows "Amount Confirmation" screen with recipient pre-filled
  2. If prefilled with recipient only: Shows "Amount Entry" screen
  3. If no prefill: Shows "Select Recipient" screen
- **Data Injection**: ChatGPT injects tool INPUT parameters into `window.openai.toolInput`

### Usage Example

**User Request:**
```
Send $75 to Jessica
```

**ChatGPT Execution:**
```
Tool: send_money
Input:
  - amount: "75"
  - recipient: "Jessica"
```

**Result:**
- Widget loads with Zelle® transfer form
- Amount field: `75`
- Recipient field: `Jessica`
- User reviews and confirms transaction

### Implementation Notes

1. **Server-Side Draft Creation**
   - Tool creates a unique draft ID for transaction tracking
   - Stores draft in-memory with 5-minute TTL
   - Returns both `draftId` and `requestId`

2. **Data Injection**
   ```javascript
   // In React widget
   const toolInput = window.openai?.toolInput || {};
   const amount = toolInput.amount || '';
   const recipient = toolInput.recipient || '';
   ```

3. **Fallback Mechanism**
   - If ChatGPT doesn't populate `toolInput`, server injects via fallback script
   - Ensures prefill works reliably

### Related Tools
- `prepare_send_money` - Two-step pattern (prepare then open)
- `open_send_money_form` - Open previously prepared transaction

---

## Prepare Send Money Tool

### Overview
Prepare a send money request without opening the widget. Use with `open_send_money_form` for two-step workflow.

### Tool ID
`prepare_send_money`

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | string | Yes | Dollar amount (format: `\d+(\.\d{1,2})?`) |
| `recipient` | string | Yes | Recipient name |

### Input Schema
```json
{
  "amount": "string (regex: ^\\d+(\\.\\d{1,2})?$)",
  "recipient": "string (min length: 1)"
}
```

### Output
```json
{
  "structuredContent": {
    "draftId": "draft_1768671503643_3ou0gjetr",
    "requestId": "req_1768671503643_qyqionpuq",
    "amount": "50.00",
    "recipient": "Sarah Chen"
  },
  "content": [
    {
      "type": "text",
      "text": "Prepared send money request: $50.00 to Sarah Chen. Draft ID: draft_1768671503643_3ou0gjetr"
    }
  ]
}
```

### Usage Example

**Step 1: Prepare**
```
Tool: prepare_send_money
Input:
  - amount: "100"
  - recipient: "David"
Result: Draft ID received
```

**Step 2: Open Form**
```
Tool: open_send_money_form
Input:
  - draftId: "draft_1768671503643_3ou0gjetr"
Result: Widget opens with prefilled data
```

### Implementation Notes

1. **Two-Step Pattern**
   - Decouples preparation from UI display
   - Allows validation/confirmation before opening widget
   - Better for complex workflows

2. **Draft Lifecycle**
   - Created with unique draftId
   - Stored server-side for 5 minutes
   - Automatically cleaned up after TTL

---

## Open Send Money Form Tool

### Overview
Open the Zelle® money transfer form for a previously prepared send money request.

### Tool ID
`open_send_money_form`

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draftId` | string | Yes | Draft ID returned from `prepare_send_money` |

### Input Schema
```json
{
  "draftId": "string (min length: 1)"
}
```

### Output
```json
{
  "structuredContent": {
    "draftId": "draft_1768671503643_3ou0gjetr",
    "amount": "100.00",
    "recipient": "David"
  },
  "content": [
    {
      "type": "text",
      "text": "Opening money transfer form for $100.00 to David..."
    }
  ]
}
```

### Error Handling

**If Draft Not Found:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: draft not found or expired. Please prepare the send money request again."
    }
  ]
}
```

### Usage Example
See [Prepare Send Money Tool](#prepare-send-money-tool) for complete two-step example.

---

## Open Application Form Tool

### Overview
Opens an embedded application form widget for credit card applications. Allows prefilling user details.

### Tool ID
`open_application_form`

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `formType` | enum | No | Application type: `rewards`, `cashback`, `travel`, `premium`, `student` | `"rewards"` |
| `firstName` | string | No | User's first name | `"John"` |
| `lastName` | string | No | User's last name | `"Smith"` |
| `email` | string (email) | No | User's email address | `"john@example.com"` |
| `phone` | string | No | User's phone number | `"555-123-4567"` |
| `country` | string | No | Country (default: "United States") | `"United States"` |
| `city` | string | No | City name | `"San Francisco"` |
| `state` | string | No | State/Province | `"CA"` |
| `address` | string | No | Street address | `"123 Main St"` |
| `zipCode` | string | No | ZIP/Postal code | `"94102"` |
| `annualIncome` | number | No | Annual income (must be ≥ 0) | `75000` |
| `employmentStatus` | enum | No | Employment: `employed`, `self-employed`, `retired`, `student`, `other` | `"employed"` |

### Input Schema
```json
{
  "formType": "enum (rewards, cashback, travel, premium, student)",
  "firstName": "string",
  "lastName": "string",
  "email": "string (email format)",
  "phone": "string",
  "country": "string",
  "city": "string",
  "state": "string",
  "address": "string",
  "zipCode": "string",
  "annualIncome": "number (≥ 0)",
  "employmentStatus": "enum (employed, self-employed, retired, student, other)"
}
```

### Output
```json
{
  "structuredContent": {
    "formType": "rewards",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "555-123-4567",
    "country": "United States",
    "city": "San Francisco",
    "state": "CA",
    "address": "123 Main St",
    "zipCode": "94102",
    "annualIncome": 75000,
    "employmentStatus": "employed"
  },
  "content": [
    {
      "type": "text",
      "text": "Opened the application form for rewards. Details will be prefilled when available."
    }
  ]
}
```

### Widget Display
- **Template**: Static HTML form
- **Resource URI**: `ui://widget/application-form.html`
- **Screens**: Multi-step application form
- **Prefill**: All provided fields are pre-populated in the form

### Usage Example

**User Request:**
```
Apply for a rewards credit card with my details: John Smith, john@example.com, employed
```

**ChatGPT Execution:**
```
Tool: open_application_form
Input:
  - formType: "rewards"
  - firstName: "John"
  - lastName: "Smith"
  - email: "john@example.com"
  - employmentStatus: "employed"
  - annualIncome: 75000
```

**Result:**
- Form opens with all fields prefilled
- User reviews and submits application

### Submitted Data Endpoint
Form submissions POST to `/api/form-submit` with all filled fields.

---

## Get Credit Card Transactions Tool

### Overview
Retrieves mock credit card transaction history for the last 30 days. Returns formatted transaction list.

### Tool ID
`get_credit_card_transactions`

### Input Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `cardLastFour` | string | No | Last 4 digits of card (e.g., "7663") | Optional |
| `limit` | number | No | Number of transactions to return | 10 |

### Input Schema
```json
{
  "cardLastFour": "string",
  "limit": "number (default: 10, max: 10)"
}
```

### Output
Text-formatted transaction history (no widget display):

```
💳 **Credit Card Transactions** (Last 10 transactions)

1. **Amazon Prime Video** (Entertainment)
   Date: 2024-11-28 | Amount: $14.99 | Status: Completed

2. **Whole Foods Market** (Groceries)
   Date: 2024-11-27 | Amount: $87.43 | Status: Completed

3. **Shell Gas Station** (Gas & Fuel)
   Date: 2024-11-26 | Amount: $52.15 | Status: Completed

... (7 more transactions)

**Total: $847.82**
```

### Mock Data
Tool returns predefined mock transactions:
- Amazon Prime Video: $14.99
- Whole Foods Market: $87.43
- Shell Gas Station: $52.15
- Nike Store: $129.99
- Starbucks Coffee: $5.47
- United Airlines: $456.00
- Netflix: $15.99
- CVS Pharmacy: $24.56
- Best Buy: $299.99
- The Cheesecake Factory: $78.35

### Usage Example

**User Request:**
```
Show me my last credit card transactions
```

**ChatGPT Execution:**
```
Tool: get_credit_card_transactions
Input:
  - limit: 10
```

**Result:**
- Formatted list of 10 most recent transactions
- Total spent amount displayed

### Implementation Notes

1. **No Widget Display**
   - Returns text content only
   - No `outputTemplate` required
   - Displayed as formatted text in chat

2. **Mock Data**
   - Returns the same 10 transactions regardless of input
   - Suitable for demo/testing
   - Replace with real data source in production

---

## Get Cashback Cards Tool

### Overview
Shows available credit cards with cashback rewards. Displays card options with brief descriptions.

### Tool ID
`get_cashback_cards`

### Input Parameters
None - this tool takes no input parameters.

### Input Schema
```json
{}
```

### Output
Widget display showing available cashback cards:

```json
{
  "structuredContent": {},
  "content": [
    {
      "type": "text",
      "text": "Here are the available cashback credit cards:\n\n1. **Active Cash® Card** - Earn unlimited 2% cash rewards on purchases\n2. **Reflect® Card** - Low intro APR for 21 months from account opening\n3. **Autograph® Card** - Earn 3X points for many ways to keep life in motion"
    }
  ]
}
```

### Widget Display
- **Template**: Static HTML card showcase
- **Resource URI**: `ui://widget/cashback-cards.html`
- **Content**: Interactive card selection with details
- **Actions**: Links to apply for cards

### Usage Example

**User Request:**
```
Show me the available cashback credit cards
```

**ChatGPT Execution:**
```
Tool: get_cashback_cards
Input: (none)
```

**Result:**
- Widget displays 3 cashback credit card options
- User can view details and apply

### Available Cards

1. **Active Cash® Card**
   - Earn unlimited 2% cash rewards on all purchases
   - No annual fee
   - Best for: General spending

2. **Reflect® Card**
   - 0% intro APR for 21 months
   - Low ongoing APR after intro period
   - Best for: Balance transfers

3. **Autograph® Card**
   - 3X points on select purchases
   - Premium benefits
   - Best for: High-spend customers

---

## Upload Image Tool

### Overview
Upload and store images from ChatGPT for processing or later reference. Converts various image formats and stores in server downloads folder.

### Tool ID
`upload_image`

### Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `imageData` | string | Yes | Image as data URL or base64-encoded string |
| `filename` | string | No | Desired filename (sanitized) |
| `mimeType` | string | No | MIME type (auto-detected from data URL if not provided) |

### Input Schema
```json
{
  "imageData": "string (data URL or base64)",
  "filename": "string",
  "mimeType": "string"
}
```

### Supported Image Formats
- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/webp` (.webp)
- `image/gif` (.gif)
- `image/bmp` (.bmp)
- `image/tiff` (.tiff)
- `image/svg+xml` (.svg)
- `image/heic` (.heic)
- `image/heif` (.heif)
- `application/pdf` (.pdf)

### Output
```json
{
  "success": true,
  "savedAs": "receipt-1768671503643.jpg",
  "savedPath": "/Users/samhitha/Downloads/ChatGpt-POC/downloads/receipt-1768671503643.jpg",
  "bytes": 245378,
  "mimeType": "image/jpeg"
}
```

### Error Response
```json
{
  "success": false,
  "error": "No valid image found. Send raw image bytes or JSON { imageData: dataURL|base64 }."
}
```

### Storage Location
Images are saved to: `./downloads/` directory

### Usage Example

**Scenario 1: From Data URL**
```
Tool: upload_image
Input:
  - imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
  - filename: "receipt"
Result: Image saved as "receipt-1768671503643.jpg"
```

**Scenario 2: From Base64**
```
Tool: upload_image
Input:
  - imageData: "/9j/4AAQSkZJRgABAQEA..."
  - filename: "document"
  - mimeType: "image/png"
Result: Image saved as "document-1768671503643.png"
```

### Implementation Notes

1. **Image Processing**
   - Accepts data URLs with embedded MIME type
   - Accepts raw base64 strings with optional mimeType parameter
   - Auto-detects MIME type from data URL if not provided
   - Adds appropriate file extension based on MIME type

2. **Filename Sanitization**
   - Removes special characters
   - Replaces spaces with underscores
   - Adds timestamp to ensure uniqueness
   - Maximum length: 180 characters

3. **HTTP Endpoint**
   - POST: `/api/chat-gpt-image`
   - Alternative to MCP tool for direct HTTP uploads
   - Returns same response format

4. **File Size Limits**
   - Express configured for 50MB max payload
   - Suitable for high-resolution images and PDFs

### List Uploaded Images Endpoint
```
GET /api/chat-gpt-image/downloads
```

Returns:
```json
{
  "count": 3,
  "files": [
    {
      "filename": "receipt-1768671503643.jpg",
      "path": "/Users/samhitha/Downloads/ChatGpt-POC/downloads/receipt-1768671503643.jpg",
      "size": 245378
    }
  ]
}
```

---

## Server Infrastructure

### MCP Endpoint
- **URL**: `/mcp`
- **Method**: POST
- **Content-Type**: application/json
- **Authentication**: MCP protocol standard

### Health Check Endpoint
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "form-demo-mcp",
  "version": "1.0.0",
  "endpoints": {
    "mcp": "/mcp",
    "formApi": "/api/form-submit",
    "imageApi": "/api/chat-gpt-image",
    "downloads": "/api/chat-gpt-image/downloads",
    "debugSessions": "/api/debug-sessions",
    "cards": "/cards.html",
    "sendMoney": "/sendmoney.html"
  },
  "downloadsDir": "/Users/samhitha/Downloads/ChatGpt-POC/downloads",
  "publicUrlGuess": "https://micheal-synergistic-lesia.ngrok-free.dev"
}
```

### Tools List Endpoint
```
GET /api/mcp-tools
```

Response:
```json
{
  "info": "Tools registered via McpServer.registerTool()",
  "tools": [
    "send_money",
    "open_send_money_form",
    "prepare_send_money",
    "open_application_form",
    "upload_image",
    "get_credit_card_transactions",
    "get_cashback_cards"
  ],
  "note": "For full details, query via /mcp with tools/list method"
}
```

---

## Data Flow Architecture

### General Tool Execution Flow

```
┌─────────────────────────────────────────────────────┐
│ ChatGPT                                             │
│ User asks for action (send money, apply, etc.)     │
└───────────────────┬─────────────────────────────────┘
                    │
                    ├─ Determines which tool to call
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ MCP Server (/mcp endpoint)                          │
│ ├─ Receive tool call request                       │
│ ├─ Execute tool handler                            │
│ ├─ Store data (drafts, sessions, uploads)          │
│ └─ Return structuredContent + content              │
└───────────────────┬─────────────────────────────────┘
                    │
                    ├─ structuredContent: Data for widget injection
                    │
                    ├─ content: Text response for chat
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ ChatGPT (Skybridge)                                 │
│ ├─ If tool has outputTemplate:                     │
│ │  ├─ Request resource from server                │
│ │  ├─ Load HTML/widget in iframe                  │
│ │  └─ Inject tool input via window.openai         │
│ │                                                  │
│ └─ Display text content in chat                    │
└─────────────────────────────────────────────────────┘
```

---

## Authentication & Security

### Current Implementation
- No API key authentication
- No request signing
- Suitable for demo/POC only

### Production Recommendations
1. Add OAuth 2.0 or API key authentication
2. Implement request signing (HMAC-SHA256)
3. Add CORS restrictions
4. Validate all input parameters
5. Rate limiting (prevent abuse)
6. HTTPS only
7. Input sanitization for all string fields

---

## Error Handling

### Standard Error Response

All tools return appropriate error messages when inputs are invalid:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: [specific error message]"
    }
  ]
}
```

### Validation Errors

**Send Money Tool:**
- Missing amount: "Error: both amount and recipient are required"
- Invalid amount format: Regex validation fails
- Missing recipient: Fails validation

**Application Form Tool:**
- Invalid email format: "Invalid email format"
- Negative annual income: "Annual income must be a positive number"
- Missing required fields: Lists missing fields

**Upload Image Tool:**
- No image data: "No valid image found..."
- Invalid format: Attempts to parse, fails with descriptive error

---

## Testing & Debugging

### Server Status Endpoint
```bash
curl http://localhost:3000/api/mcp-status
```

### Available Debug Endpoints
- `/api/mcp-status` - MCP server health
- `/api/mcp-tools` - List registered tools
- `/api/debug-sessions` - Image upload sessions
- `/api/sendmoney-latest` - Latest send money draft (fallback data)
- `/health` - Full server health check

### Browser Console Debugging

**For Send Money Widget:**
```javascript
console.log(window.openai?.toolInput);
// Shows: { amount: "50", recipient: "Sarah" }
```

**For Application Form:**
```javascript
console.log(window.openai?.toolInput);
// Shows: { firstName: "John", lastName: "Smith", ... }
```

---

## Deployment

### Local Development
```bash
npm install
npm run build
npm start
```
Server runs on `http://localhost:3000`

### Production Deployment (with ngrok)
```bash
npm start
# In another terminal:
ngrok http 3000
```
Get public URL: `https://*.ngrok-free.dev`

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Troubleshooting

### Tool Not Appearing in ChatGPT
1. Verify MCP endpoint URL is correct
2. Check server is running: `curl http://localhost:3000/health`
3. List tools: `curl http://localhost:3000/api/mcp-tools`
4. Check ChatGPT connector logs for MCP errors

### Widget Not Loading
1. Verify resource handler returns HTML with correct MIME type
2. Check browser console for 404 errors
3. Verify resource URI matches tool's `outputTemplate`
4. Check server logs for resource handler errors

### Data Not Prefilling
1. Check `window.openai?.toolInput` in browser console
2. Verify React reads from correct property
3. Check fallback injection script is present in HTML
4. Look for JavaScript errors in browser console

### Form Submission Failures
1. Check `/api/form-submit` endpoint is working
2. Verify all required fields are provided
3. Check email format validation
4. Check server logs for validation errors

---

## API Limits & Constraints

| Constraint | Value | Notes |
|-----------|-------|-------|
| Max payload size | 50MB | Express limit for JSON and raw |
| Draft TTL | 5 minutes | Auto-cleanup of old drafts |
| Transaction history | 10 mock transactions | Fixed demo data |
| Image formats supported | 9 types | JPEG, PNG, WebP, GIF, BMP, TIFF, SVG, HEIC, PDF |
| Max filename length | 180 chars | Sanitized and truncated |
| Amount decimal places | 2 | Regex: `\d+(\.\d{1,2})?` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Jan 17, 2026 | Complete tool documentation, fixed window.openai.toolInput data injection |
| 1.5 | Jan 16, 2026 | Added fallback injection for widget data |
| 1.0 | Jan 15, 2026 | Initial MCP server with 6 tools |

---

## Support & Contributing

For issues, improvements, or new tools:
1. Check this documentation first
2. Review server logs: `npm start`
3. Check browser console for client-side errors
4. Test with isolated tool calls before full integration

---

**Last Updated:** January 17, 2026  
**Status:** Production Ready  
**Maintainer:** ChatGPT POC Team
