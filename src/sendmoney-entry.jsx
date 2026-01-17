import React from 'react';
import { createRoot } from 'react-dom/client';
import SendMoneyApp from './components/SendMoneyApp';
import './styles/sendmoney.css';

// Debug: Log what Skybridge provides
console.log('=== Skybridge Widget Initialization ===');
console.log('window.openai:', window.openai);
console.log('window.openai?.toolInput:', window.openai?.toolInput);
console.log('window.openai?.toolOutput:', window.openai?.toolOutput);

// Get prefill data from Skybridge's toolInput (the tool's input parameters)
// ChatGPT injects the tool INPUT (what it sent to the tool) into toolInput
// NOT the tool output into toolOutput
const toolInput = window.openai?.toolInput || {};
const amount = toolInput.amount || '';
const recipient = toolInput.recipient || '';
const startScreenHint = toolInput.startScreen || null; // Tool can suggest which screen to show

// Determine start screen:
// 1. If tool explicitly suggests (has both amount AND recipient), use 'amount' for confirmation
// 2. If only amount is provided, start on recipient selection
// 3. If only recipient is provided, start on amount entry
// 4. Otherwise, start on recipient selection (blank form)
let startScreen = 'select'; // default
if (startScreenHint) {
  // Tool provided explicit hint
  startScreen = startScreenHint;
  console.log('📋 Using startScreen hint from tool:', startScreenHint);
} else if (amount && !recipient) {
  startScreen = 'select'; // Amount-only: show recipient selection
} else if (recipient && !amount) {
  startScreen = 'amount'; // Recipient-only: show amount entry
} else if (amount && recipient) {
  startScreen = 'amount'; // Both: show confirmation screen
}

console.log('SendMoney Entry - Data from Skybridge toolInput:');
console.log('  - toolInput:', toolInput);
console.log('  - amount:', amount || '(empty)');
console.log('  - recipient:', recipient || '(empty)');
console.log('  - startScreen:', startScreen);

const root = createRoot(document.getElementById('root'));
root.render(
  <SendMoneyApp 
    initialAmount={amount} 
    initialRecipient={recipient}
    startScreen={startScreen}
  />
);
