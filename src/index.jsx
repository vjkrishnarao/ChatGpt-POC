import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import CardsApp from './components/CardsApp';
import SendMoneyApp from './components/SendMoneyApp';
import './styles/cards.css';
import './styles/sendmoney.css';

const App = () => {
  const [page, setPage] = useState('cards');
  const [params, setParams] = useState({});

  useEffect(() => {
    // Parse URL to determine which page to show
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    if (path.includes('sendmoney')) {
      setPage('sendmoney');
      const amount = urlParams.get('amount') || '';
      const recipient = urlParams.get('recipient') || '';
      let startScreen = 'select';
      
      if (recipient && amount) {
        startScreen = 'amount';
      } else if (amount) {
        startScreen = 'add';
      }
      
      setParams({ amount, recipient, startScreen });
    } else {
      setPage('cards');
    }
  }, []);

  if (page === 'sendmoney') {
    return (
      <SendMoneyApp 
        initialAmount={params.amount || ''} 
        initialRecipient={params.recipient || ''}
        startScreen={params.startScreen || 'select'}
      />
    );
  }

  return <CardsApp />;
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
