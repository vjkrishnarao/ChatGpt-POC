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

// Start with amount entry screen if we have an amount, otherwise recipient selection
let startScreen = amount ? 'amount' : 'select';

console.log('SendMoney Entry - Data from Skybridge toolInput:');
console.log('  - toolInput:', toolInput);
console.log('  - amount:', amount);
console.log('  - recipient:', recipient);
console.log('  - startScreen:', startScreen);

const root = createRoot(document.getElementById('root'));
root.render(
  <SendMoneyApp 
    initialAmount={amount} 
    initialRecipient={recipient}
    startScreen={startScreen}
  />
);
