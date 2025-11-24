# Bank Account MCP Server for ChatGPT

This is a Model Context Protocol (MCP) server that integrates with ChatGPT to display an interactive bank account opening wizard.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the MCP Server
```bash
node server.mjs
```

The server will output:
```
🏦 Bank Account MCP Server running on stdio
📋 Tools: open_bank_account_wizard, get_account_details, validate_account_application
```

## Integrating with ChatGPT

### Step 1: Get the Full Path to server.mjs
```bash
pwd
# Example output: /Users/Vijay/forChatGpt
# Full path to server: /Users/Vijay/forChatGpt/server.mjs
```

### Step 2: Configure in ChatGPT

1. Go to **ChatGPT Settings** → **Developer settings** → **MCP Servers** (or similar, depending on your ChatGPT version)

2. Click **Add MCP Server** or **Add Custom Server**

3. Fill in the configuration:
   - **Name**: `Bank Account Server`
   - **Type**: `stdio`
   - **Command**: `node`
   - **Arguments**: `["/Users/Vijay/forChatGpt/server.mjs"]`

4. Save and restart ChatGPT

### Step 3: Use in ChatGPT

Once configured, you can ask ChatGPT:
- "Help me open a bank account"
- "Show me the account opening wizard"
- "I want to open a savings account"

ChatGPT will automatically:
1. Call the `open_bank_account_wizard` tool
2. Display the interactive HTML form in an iframe widget
3. Users can fill out and submit the form directly in the chat

## Available Tools

### 1. `open_bank_account_wizard`
Displays an interactive bank account opening form with:
- Account type selection (Savings, Checking, Business)
- Personal information fields (Name, Email, Phone)
- Form validation and success feedback

**Usage**: ChatGPT calls this automatically when discussing account opening

### 2. `get_account_details`
Returns details about a specific account type

**Parameters**:
- `account_type` (string): `"savings"`, `"checking"`, or `"business"`

**Example**: "Tell me about savings accounts" → Returns detailed account information

### 3. `validate_account_application`
Validates account application data

**Parameters**:
- `email` (string): Email address
- `age` (number): Applicant age
- `country` (string): Country of residence

**Example**: "Validate that john@example.com, age 25, from USA" → Returns validation result

## Files

- `server.mjs` - Main MCP server with ChatGPT integration
- `browser.mjs` - Optional HTTP server for local testing (http://localhost:3000)
- `package.json` - Project dependencies
- `tsconfig.json` - TypeScript configuration

## Testing Locally

To see the form in a browser before deploying:

```bash
node browser.mjs
# Open http://localhost:3000 in your browser
```

## Architecture

The MCP server:
- Uses the official `@modelcontextprotocol/sdk` package
- Implements stdio-based transport for ChatGPT integration
- Includes metadata (`_meta["openai/outputTemplate"]`) to instruct ChatGPT to render HTML as a widget
- Provides three tools that ChatGPT can call automatically

## Notes

- The server runs on Node.js v20+ without any external HTTP dependencies
- All tools are stateless - no data is persisted
- The HTML form is embedded as base64 in the tool metadata for ChatGPT rendering
- For production use, consider adding data validation and backend integration

## Support

If you encounter issues:
1. Ensure Node.js is installed: `node --version`
2. Check dependencies: `npm install`
3. Verify server starts: `node server.mjs` (should not error)
4. Test MCP communication: Try calling tools via ChatGPT's interface
