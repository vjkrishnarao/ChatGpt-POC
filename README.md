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
**1. Install ngrok
**
Grab it from the official site, unzip it, and stick the binary somewhere in your PATH.
If you can run ngrok --version without your terminal whining, you’re good.

**2. Make an ngrok account
**
They want you logged in so they know who to blame when you accidentally tunnel your mom’s printer.

**3. Add your authtoken
**
From your ngrok dashboard, copy the authtoken and run:

ngrok config add-authtoken <your_token_here>


If you paste the wrong thing, ngrok will not be shy about scolding you.

**4. Run a tunnel
**
Pick the service you want to expose.
For a typical local server running on port 3000:

**ngrok http 3000
**

Suddenly your localhost has a public URL. Try not to panic.

**5. Check the web UI
**
Ngrok gives you a handy status dashboard:

http://localhost:4040

Then just run:

**ngrok start myapp**

This should provide the ngrok url which can be accessed from anywhere in web

You can see requests, inspect payloads, and contemplate your life choices.
## Integrating with ChatGPT

Eligibility: Available in beta to Pro, Plus, Business, Enterprise and Education accounts on the web.

Enable developer mode: Go to 
Settings → Connectors
 → Advanced → Developer mode.

Import MCPs:

Open ChatGPT settings.
In the Connectors tab, add your remote MCP server. It will appear in the composer's "Developer Mode" tool later during conversations.
Supported connector protocols: SSE and streaming HTTP.
Authentication supported: OAuth or no authentication. (Choose no authentication)

4. Save and restart ChatGPT

### Step 3: Use in ChatGPT

**Once configured, you can ask ChatGPT:**
- "Help me open a bank account"
- "Show me the account opening wizard"
- "I want to open a savings account"

ChatGPT will automatically:
1. Call the `open_bank_account_wizard` tool
2. Display the interactive HTML form in an iframe widget
3. Users can fill out and submit the form directly in the chat
