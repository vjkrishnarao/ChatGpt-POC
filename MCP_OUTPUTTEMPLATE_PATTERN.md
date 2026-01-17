# OpenAI ChatGPT MCP: outputTemplate & Parameter Passing Pattern

## Executive Summary

Based on analysis of MCP SDK examples, OpenAI ChatGPT integration patterns, and your implementation, here is the **authoritative pattern** for how ChatGPT handles outputTemplate and passes parameters to resources:

---

## 1. How outputTemplate Works with structuredContent

### The Pattern (Your Implementation is Correct)

```javascript
// TOOL DEFINITION - Static outputTemplate
server.registerTool("open_send_money_form", {
  // ... inputSchema, description, etc.
  _meta: {
    "openai/outputTemplate": "ui://widget/sendmoney.html?draftId={draftId}"
  }
}, 
async ({ draftId }) => {
  const draft = getSendMoneyDraft(draftId);
  
  return {
    // ✅ Clients use structuredContent for dynamic data
    structuredContent: {
      draftId,
      amount: draft.amount,
      recipient: draft.recipient
    },
    
    // ✅ Text content for fallback/display
    content: [{
      type: "text",
      text: `Opening money transfer form...`
    }]
  };
});

// RESOURCE HANDLER - Receives URI with substituted parameters
server.registerResource(
  "sendmoney-ui",
  "ui://widget/sendmoney.html",  // Static URI template
  { /* metadata */ },
  async (uri, resourceRequest) => {
    // Extract substituted parameter from URI
    const url = new URL(uri.href);
    const draftId = url.searchParams.get('draftId');
    
    // Use draftId to fetch and return dynamic content
    const draft = getSendMoneyDraft(draftId);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/html+skybridge",
        text: htmlContent  // Dynamic HTML rendered with draft data
      }]
    };
  }
);
```

### How it Works

1. **Tool declares static `outputTemplate`** in `_meta["openai/outputTemplate"]`
   - Can contain template variables: `ui://widget/sendmoney.html?draftId={draftId}`
   - ChatGPT **substitutes variables from tool output** (structuredContent or tool arguments)

2. **Tool returns `structuredContent`** with the data
   - This is **NOT** automatically passed to the resource handler
   - Instead, the `structuredContent` fields are used to **substitute variables** in the outputTemplate

3. **ChatGPT constructs the resource URI** by substituting template variables
   - Example: `{draftId}` in template becomes `sendmoney-draft-123` from structuredContent
   - Final URI: `ui://widget/sendmoney.html?draftId=sendmoney-draft-123`

4. **Resource handler receives the constructed URI**
   - Parses URL query parameters to extract the substituted values
   - Uses these values to fetch/generate dynamic content

---

## 2. Should Template Variables Like {draftId} Be Substituted from structuredContent Fields?

### ✅ YES - This is the Correct Pattern

**ChatGPT extracts template variable values from:**
1. **structuredContent** fields (highest priority)
2. **Tool input arguments** (if not in structuredContent)

### Example

```javascript
// Tool returns structuredContent
return {
  structuredContent: {
    draftId: "sendmoney-draft-12345",  // ← Used for {draftId} substitution
    amount: "150.00",
    recipient: "John Doe"
  },
  content: [{ type: "text", text: "..." }]
};

// ChatGPT substitutes: ui://widget/sendmoney.html?draftId={draftId}
// Results in: ui://widget/sendmoney.html?draftId=sendmoney-draft-12345
```

**Key Point:** The variables in `outputTemplate` must **exactly match field names** in either:
- `structuredContent` from the tool response
- Input parameters to the tool

If a variable isn't found, ChatGPT may:
- Leave it as-is (not substitute)
- Fail to render the resource
- Use a default/fallback value

---

## 3. Correct Way to Make Tools Render Resources with Dynamic Parameters

### Pattern: Two-Step Design

**Step 1: Prepare Data** (returns identifier)
```javascript
server.registerTool("prepare_send_money", {
  inputSchema: z.object({
    amount: z.string(),
    recipient: z.string()
  })
}, async ({ amount, recipient }) => {
  // Create server-side state/draft
  const draftId = createSendMoneyDraft(amount, recipient);
  
  return {
    structuredContent: { draftId, amount, recipient },
    content: [{
      type: "text",
      text: `Prepared draft: ${draftId}`
    }]
  };
});
```

**Step 2: Open UI** (uses identifier to fetch data)
```javascript
server.registerTool("open_send_money_form", {
  inputSchema: z.object({
    draftId: z.string()
  }),
  _meta: {
    // ✅ Static template - ChatGPT substitutes {draftId} from tool argument/output
    "openai/outputTemplate": "ui://widget/sendmoney.html?draftId={draftId}"
  }
}, async ({ draftId }) => {
  const draft = getSendMoneyDraft(draftId);
  
  return {
    // Include data in structuredContent for client consumption
    structuredContent: {
      draftId,
      amount: draft.amount,
      recipient: draft.recipient
    },
    content: [{
      type: "text",
      text: `Opening form for $${draft.amount} to ${draft.recipient}`
    }]
  };
});
```

**Resource Handler** (serves dynamic content)
```javascript
server.registerResource(
  "sendmoney-ui",
  "ui://widget/sendmoney.html",  // ← Static base URI
  { mimeType: "text/html+skybridge" },
  async (uri) => {
    // Extract substituted parameter
    const url = new URL(uri.href);
    const draftId = url.searchParams.get('draftId');
    
    // Fetch server-side data
    const draft = getSendMoneyDraft(draftId);
    
    // Return dynamic content
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/html+skybridge",
        text: generateHTML(draft)  // ← Dynamic based on draftId
      }]
    };
  }
);
```

### Flow Diagram

```
Tool: prepare_send_money
├─ Output: { structuredContent: { draftId: "draft-123" } }
└─ Result: Draft created in server memory

     ↓

Tool: open_send_money_form
├─ Input: { draftId: "draft-123" }
├─ outputTemplate: "ui://widget/sendmoney.html?draftId={draftId}"
├─ ChatGPT substitutes {draftId} from input → "...?draftId=draft-123"
└─ Output: { structuredContent: { draftId, amount, recipient } }

     ↓

Resource: ui://widget/sendmoney.html?draftId=draft-123
├─ Handler receives: URI with query param "draftId=draft-123"
├─ Extracts: draftId from URL
├─ Fetches: Draft data from server memory
└─ Returns: Dynamic HTML with prefilled data
```

---

## 4. Known Patterns and Antipatterns for MCP Tool-Resource Integration

### ✅ PATTERNS (DO THIS)

#### 1. **Static outputTemplate Declaration**
```javascript
// ✅ CORRECT - Declare at tool registration time
_meta: {
  "openai/outputTemplate": "ui://widget/sendmoney.html?draftId={draftId}"
}

// ❌ WRONG - Runtime dynamic outputTemplate
return {
  _meta: {
    "openai/outputTemplate": `ui://widget/sendmoney.html?session=${sessionId}`
  },
  content: [...]
};
// ^ ChatGPT doesn't reliably honor dynamic outputTemplate at runtime
```

#### 2. **Store State Server-Side, Pass Identifier**
```javascript
// ✅ CORRECT
const draftId = createSendMoneyDraft(amount, recipient);
return {
  structuredContent: { draftId },  // ← Identifier only
  content: [...]
};

// Resource handler uses draftId to fetch full data
const draft = getSendMoneyDraft(draftId);
return { contents: [{ text: renderHTML(draft) }] };

// ❌ WRONG - Passing large payloads in structuredContent
return {
  structuredContent: {
    htmlContent: "<div>...</div>",  // Don't embed HTML here
    largeDataset: [...1000 items...],  // Too much data
  }
};
```

#### 3. **Use structuredContent for Client-Readable Data**
```javascript
// ✅ CORRECT - structuredContent is for clients/LLMs to read
return {
  structuredContent: {
    draftId: "draft-123",
    amount: "150.00",
    recipient: "John Doe",
    status: "ready"
  },
  content: [{
    type: "text",
    text: `Draft created: $150 to John Doe. Draft ID: draft-123`
  }]
};
```

#### 4. **Use Resource Handlers for Dynamic Content**
```javascript
// ✅ CORRECT - Resource handler generates/fetches dynamic content
server.registerResource("name", "ui://widget/...", {}, async (uri) => {
  const param = new URL(uri.href).searchParams.get('draftId');
  const data = fetchDynamicData(param);
  return {
    contents: [{
      uri: uri.href,
      mimeType: "text/html+skybridge",
      text: renderDynamicHTML(data)  // ← Generated per request
    }]
  };
});
```

#### 5. **Match Template Variables to Field Names Exactly**
```javascript
// outputTemplate uses {draftId}
_meta: {
  "openai/outputTemplate": "ui://widget/form.html?draftId={draftId}"
}

// Must have matching field in structuredContent or input
return {
  structuredContent: {
    draftId: "...",  // ← Must match {draftId} exactly
    amount: "..."
  }
};
```

---

### ❌ ANTIPATTERNS (AVOID)

#### 1. **Dynamic outputTemplate at Runtime**
```javascript
// ❌ WRONG
return {
  _meta: {
    "openai/outputTemplate": `ui://widget/form.html?session=${sessionId}`  
  },
  content: [...]
};
// Reason: ChatGPT client caches tool definitions; runtime changes aren't honored
// Fix: Declare static template; pass session ID via query param in tool return value
```

#### 2. **Large Data in structuredContent**
```javascript
// ❌ WRONG
return {
  structuredContent: {
    completeHTMLPage: "<html>...</html>",  // Embedding HTML/large content
    allTableData: [... massive array ...]
  }
};
// Reason: structuredContent is meant for structured data, not rendering
// Fix: Use resource handler to generate dynamic HTML
```

#### 3. **Missing or Mismatched Template Variables**
```javascript
// ❌ WRONG
_meta: {
  "openai/outputTemplate": "ui://widget/form.html?userId={userId}"
}
return {
  structuredContent: {
    draftId: "...",  // ← Doesn't match {userId}!
    amount: "..."
  }
};
// ChatGPT can't substitute {userId} - rendering fails or URI is malformed
```

#### 4. **Relying on Clients to Construct Resource URIs**
```javascript
// ❌ WRONG - Expecting client to manually build URI
return {
  structuredContent: {
    baseUrl: "ui://widget/form.html",
    params: { draftId: "123" }
  },
  content: [{
    type: "text",
    text: "Go to ui://widget/form.html?draftId=123"
  }]
};
// Reason: Clients may not construct URI correctly; use outputTemplate instead

// ✅ CORRECT
_meta: {
  "openai/outputTemplate": "ui://widget/form.html?draftId={draftId}"
}
return {
  structuredContent: { draftId: "123" },
  content: [...]
};
```

#### 5. **Assuming structuredContent is Passed to Resource Handler**
```javascript
// ❌ WRONG - This doesn't happen
// Tool returns:
return {
  structuredContent: { draftId: "123", secret: "data" }
};

// Resource handler receives:
async (uri, resourceRequest) => {
  // resourceRequest does NOT have structuredContent from tool!
  // Only the URI is passed
  // You must extract parameters from URI
};
```

#### 6. **Forgetting to Extract Parameters from URI**
```javascript
// ❌ WRONG - Ignoring URI parameters
async (uri, resourceRequest) => {
  const draft = getSendMoneyDraft("hardcoded-id");  // ← Wrong!
  return { contents: [...] };
};

// ✅ CORRECT
async (uri, resourceRequest) => {
  const url = new URL(uri.href);
  const draftId = url.searchParams.get('draftId');  // ← Extract from URI
  const draft = getSendMoneyDraft(draftId);
  return { contents: [...] };
};
```

---

## 5. Special Considerations for ChatGPT Integration

### Cache Busting
ChatGPT may cache resources. If you need fresh data on each request:

```javascript
// Add cache-busting metadata
return {
  contents: [{
    uri: `${uri.href}#${Date.now()}`,  // ← Add timestamp hash
    mimeType: "text/html+skybridge",
    text: dynamicHTML
  }],
  _meta: {
    "cache-control": "no-cache, no-store, must-revalidate",
    "pragma": "no-cache",
    "expires": "0"
  }
};
```

### HTML Rendering
For `text/html+skybridge` MIME type:

```javascript
// ✅ Inject data as script variables for React/JS to read
const html = `
  <!DOCTYPE html>
  <html>
  <head>...</head>
  <body>
    <script>
      window.__DRAFT_DATA__ = {
        draftId: '${draftId}',
        amount: '${amount}',
        recipient: '${recipient}'
      };
    </script>
    <div id="app"><!-- React mounts here --></div>
  </body>
  </html>
`;
```

### Session Management (Server-Side)
Use in-memory maps or database for draft/session storage:

```javascript
const draftStore = new Map();

function createDraft(data) {
  const id = `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  draftStore.set(id, { ...data, createdAt: Date.now() });
  return id;
}

function getDraft(id) {
  const draft = draftStore.get(id);
  if (!draft) return null;
  
  // Optional: implement expiration
  const age = Date.now() - draft.createdAt;
  if (age > 30 * 60 * 1000) {  // 30 min expiry
    draftStore.delete(id);
    return null;
  }
  
  return draft;
}
```

---

## 6. Reference Implementation Summary (Your Code)

Your implementation **correctly follows the pattern**:

1. ✅ **Tool declares static outputTemplate** with template variable:
   ```javascript
   "openai/outputTemplate": "ui://widget/sendmoney.html?draftId={draftId}"
   ```

2. ✅ **Tool returns structuredContent** with the substitution value:
   ```javascript
   return {
     structuredContent: { draftId, amount, recipient },
     content: [...]
   };
   ```

3. ✅ **Resource handler extracts parameter from URI**:
   ```javascript
   const draftId = new URL(uri.href).searchParams.get('draftId');
   ```

4. ✅ **Resource handler uses parameter to fetch dynamic data**:
   ```javascript
   const draft = getSendMoneyDraft(draftId);
   ```

5. ✅ **Returns dynamic HTML** with injected data:
   ```javascript
   return {
     contents: [{
       uri: responseUri,
       mimeType: "text/html+skybridge",
       text: sendmoneyHtml  // ← Injected with draft data
     }]
   };
   ```

---

## 7. Key Takeaways

| Concept | Rule |
|---------|------|
| **outputTemplate** | Declare **statically** on tool; must be string with template variables |
| **Template Variables** | Substituted from `structuredContent` fields matching variable names |
| **structuredContent** | Contains **data for substitution**; NOT passed to resource handler |
| **Resource Handler** | Receives **URI with substituted parameters**; extracts from query string |
| **Dynamic Content** | Generated in **resource handler**, not at tool return time |
| **State Management** | Store server-side (memory/DB); pass only **identifier** to client |
| **Flow** | Tool prepares data → returns ID → Resource handler fetches data → renders |

---

## 8. Official References

- **MCP SDK Examples**: https://github.com/modelcontextprotocol/python-sdk/tree/main/examples
  - Resource templates: `examples/fastmcp/readme-quickstart.py`
  - Structured output: `examples/snippets/servers/structured_output.py`
  
- **MCP Spec**: https://spec.modelcontextprotocol.io/latest/
  - Resource templates: RFC 6570 URI templates
  - Tool output: Structured content support

- **Your Implementation**: `/Users/samhitha/Downloads/ChatGpt-POC/server.mjs`
  - Lines 91-97: Pattern explanation comments
  - Lines 520-615: Two-step tool pattern (prepare + open)
  - Lines 625-750: Resource handler with parameter extraction

