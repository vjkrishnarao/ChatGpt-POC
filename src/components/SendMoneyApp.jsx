import React, { useState } from 'react';

const SendMoneyApp = ({ initialAmount = '', initialRecipient = '', startScreen = 'select' }) => {
  const recentRecipients = [
    { name: 'Michelle Moore', phone: '(123) 456-7890', initial: 'MM' },
    { name: 'Sarah Mitchell', phone: '(415) 234-5678', initial: 'SM' },
    { name: 'David Chen', phone: '(650) 789-4321', initial: 'DC' },
    { name: 'Emily Rodriguez', email: 'emily.rodriguez@email.com', initial: 'ER' },
    { name: 'Michael Thompson', phone: '(925) 567-8901', initial: 'MT' },
    { name: 'Jessica Park', email: 'jpark@example.com', initial: 'JP' },
    { name: 'Robert Anderson', phone: '(510) 432-7890', initial: 'RA' }
  ];

  // Find matching recipient from the list (support partial name matching)
  const findRecipient = (name) => {
    if (!name) return null;
    const searchName = name.toLowerCase().trim();
    return recentRecipients.find(rec => 
      rec.name.toLowerCase().includes(searchName) || 
      searchName.includes(rec.name.toLowerCase().split(' ')[0]) // Match first name
    );
  };

  const matchedRecipient = findRecipient(initialRecipient);
  const finalRecipient = matchedRecipient ? matchedRecipient.name : initialRecipient;
  const finalPhone = matchedRecipient ? (matchedRecipient.phone || matchedRecipient.email || '') : '';

  const hasInitialData = Boolean(initialAmount || initialRecipient);

  const [screen, setScreen] = useState(startScreen);
  const [recipient, setRecipient] = useState(finalRecipient);
  const [amount, setAmount] = useState(initialAmount);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [memo, setMemo] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  
  // Account options
  const accounts = [
    { id: 'checking', name: 'EVERYDAY CHECKING ...7663', balance: '$1,284.94' },
    { id: 'savings', name: 'SAVINGS ...7664', balance: '$5,000.00' }
  ];
  
  const [selectedAccountId, setSelectedAccountId] = useState('checking');
  
  // Get selected account details
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  // Format phone number for display
  const formatPhoneForDisplay = (phone) => {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Mask first 6 digits with asterisks, show last 4 digits
    if (digits.length >= 10) {
      return `(***) ***-${digits.slice(-4)}`;
    }
    return phone;
  };

  // Currency input handler - shifts digits left, always shows 0.00 format
  const handleCurrencyInput = (e) => {
    const inputValue = e.currentTarget.value;
    
    // Extract only numeric digits from input
    const digits = inputValue.replace(/[^0-9]/g, '');
    
    // If empty, show 0.00
    if (!digits) {
      setAmount('0.00');
      return;
    }
    
    // We need at least 3 characters to split into int.decimal
    // For amounts like: 1 -> 0.01, 12 -> 0.12, 123 -> 1.23, 1234 -> 12.34
    
    let displayDigits = digits;
    
    // Ensure we have at least 3 digits by padding left with zeros only if needed
    if (displayDigits.length < 3) {
      displayDigits = displayDigits.padStart(3, '0');
    }
    
    // Split: last 2 digits are decimals, rest are integer
    let integerPart = displayDigits.slice(0, -2) || '0';
    const decimalPart = displayDigits.slice(-2);
    
    // Remove leading zeros from integer part
    integerPart = integerPart.replace(/^0+/, '') || '0';
    
    const formatted = `${integerPart}.${decimalPart}`;
    
    setAmount(formatted);
  };

  // Debug log
  React.useEffect(() => {
    console.log('SendMoneyApp mounted:', { 
      initialAmount, 
      initialRecipient, 
      matchedRecipient: matchedRecipient?.name,
      finalRecipient,
      finalPhone,
      startScreen, 
      amount, 
      recipient 
    });
  }, []);

  const handleSelectRecipient = (rec) => {
    setRecipient(rec.name);
    setRecipientPhone(rec.phone || rec.email || '');
    setSearchInput('');
    setScreen('amount');
  };

  const handleAddRecipient = () => {
    if (recipientName && recipientPhone) {
      setRecipient(recipientName);
      setSearchInput('');
      setScreen('amount');
    }
  };

  // Filter recipients based on search input
  const getFilteredRecipients = () => {
    if (!searchInput.trim()) return recentRecipients;
    
    const searchTerm = searchInput.toLowerCase().trim();
    return recentRecipients.filter(rec =>
      rec.name.toLowerCase().includes(searchTerm) ||
      rec.phone?.includes(searchTerm) ||
      rec.email?.includes(searchTerm)
    );
  };

  const filteredRecipients = getFilteredRecipients();
  const hasMatchingRecipient = filteredRecipients.length > 0;

  const handleReview = () => {
    setScreen('confirm');
  };

  const handleSend = () => {
    setVerificationCode('123456');
    setEnteredCode('');
    setScreen('verify');
  };

  const handleVerifyCode = () => {
    if (enteredCode === verificationCode) {
      setConfirmationCode(`WFCT0ZPT${Math.floor(Math.random() * 10000)}`);
      setScreen('success');
    }
  };

  // Select Recipient Screen
  if (screen === 'select') {
    return (
      <div className="send-money-container">
        <div className="send-money-header">
          <h1>Select recipient</h1>
        </div>
        {!hasInitialData && (
          <>
          {/* 
          <div className="info-box" style={{ marginTop: 8 }}>
            <span className="info-icon">ⓘ</span>
            <p>
              ChatGPT didn't provide an amount or recipient for this session.
              Please choose who to pay and enter the details manually.
            </p>
          </div>
          */}
          </>
        )}
        
        <div className="search-section">
          <div className="search-bar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#666" strokeWidth="2"/>
              <path d="M21 21L16.65 16.65" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input 
              type="text" 
              placeholder="Add / Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button className="info-btn">ⓘ</button>
          </div>
          <button className="scan-btn">
            <svg width="24" height="24" fill="#5B2C9F">
              <rect x="2" y="2" width="9" height="9"/>
              <rect x="13" y="2" width="9" height="9"/>
              <rect x="2" y="13" width="9" height="9"/>
              <rect x="13" y="13" width="9" height="9"/>
            </svg>
            <span>Scan</span>
          </button>
        </div>

        <div className="recent-section">
          {searchInput.trim() && (
            <h3>Results for "{searchInput}"</h3>
          )}
          {!searchInput.trim() && (
            <h3>Recent</h3>
          )}
          {hasMatchingRecipient ? (
            filteredRecipients.map((rec, idx) => (
              <div key={idx} className="recipient-item" onClick={() => handleSelectRecipient(rec)}>
                <div className="recipient-avatar" style={{ backgroundColor: '#5B2C9F' }}>
                  {rec.initial}
                </div>
                <div className="recipient-info">
                  <div className="recipient-name">{rec.name}</div>
                  <div className="recipient-contact">{rec.phone || rec.email}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
              No matching recipients found
            </div>
          )}
        </div>

        {searchInput.trim() && !hasMatchingRecipient && (
          <button className="action-btn-secondary" onClick={() => setScreen('add')}>
            Add New Recipient
          </button>
        )}
        
        {!searchInput.trim() && (
          <button className="action-btn-secondary" onClick={() => setScreen('add')}>
            Add New Recipient
          </button>
        )}
      </div>
    );
  }

  // Add Recipient Screen
  if (screen === 'add') {
    return (
      <div className="send-money-container">
        <div className="send-money-header">
          <h1>Add recipient</h1>
        </div>

        <div className="warning-box">
          <span className="warning-icon">⚠</span>
          <p>Only use this service to pay people and businesses you know and trust.</p>
        </div>

        <div className="form-group">
          <label>Recipient's name</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Enter name"
          />
        </div>

        <div className="form-group">
          <p className="form-label">Choose how to add them</p>
          <div className="radio-group">
            <label className="radio-item">
              <input type="radio" name="addMethod" defaultChecked />
              <span>Mobile number</span>
            </label>
            <label className="radio-item">
              <input type="radio" name="addMethod" />
              <span>Email</span>
            </label>
            <label className="radio-item">
              <input type="radio" name="addMethod" />
              <span>Business tag</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Their mobile number</label>
          <input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="(___) ___-____"
          />
        </div>

        {recipientName && recipientPhone && (
          <div className="info-box">
            <span className="info-icon">ⓘ</span>
            <p>
              <strong>{recipientName}</strong> must be enrolled with this service using{' '}
              <strong>{recipientPhone}</strong> to receive money.
            </p>
          </div>
        )}

        <p className="terms-text">
          By adding this recipient, you agree to receive text messages about your transaction activity. 
          Message and data rates may apply.
        </p>

        <div className="button-row">
          <button className="action-btn-secondary" onClick={() => setScreen('select')}>
            Cancel
          </button>
          <button className="action-btn-primary" onClick={handleAddRecipient}>
            Next
          </button>
        </div>
      </div>
    );
  }

  // Enter Amount Screen
  if (screen === 'amount') {
    return (
      <div className="send-money-container">
        <div className="send-money-header">
          <h1>Enter amount</h1>
        </div>

        <div className="recipient-card-container">
          <div className="recipient-card">
            <div className="recipient-avatar-large" style={{ backgroundColor: '#5B2C9F' }}>
              {recipient.charAt(0).toUpperCase()}
            </div>
            <h2>Send to {recipient}</h2>
            <p className="enrolled-text">Added as {recipient.toUpperCase()}</p>
          </div>

          <div className="amount-input-section">
            <input
              type="text"
              className="amount-input"
              value={amount}
              onChange={handleCurrencyInput}
              placeholder="$0.00"
              inputMode="numeric"
            />
            <p className="limits-text">Limits: $3,500.00/day; $18,674.00/30 days <span className="info-icon">ⓘ</span></p>
          </div>
        </div>

        <div className="form-group">
          <label>Pay from</label>
          <div className="custom-dropdown">
            <div
              className="dropdown-trigger"
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            >
              <div className="account-display">
                <div className="account-name">{selectedAccount?.name}</div>
                <div className="account-balance">Available balance {selectedAccount?.balance}</div>
              </div>
              <svg
                className={`dropdown-arrow ${isAccountDropdownOpen ? 'open' : ''}`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            {isAccountDropdownOpen && (
              <div className="dropdown-menu">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`dropdown-item ${selectedAccountId === account.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setIsAccountDropdownOpen(false);
                    }}
                  >
                    <div className="account-name">{account.name}</div>
                    <div className="account-balance">Available balance {account.balance}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Memo (optional)"
          />
        </div>

        <div className="button-row">
          <button className="action-btn-secondary" onClick={() => setScreen('select')}>
            Cancel
          </button>
          <button className="action-btn-primary" onClick={handleReview} disabled={!amount}>
            Review
          </button>
        </div>
      </div>
    );
  }

  // Confirmation Screen
  if (screen === 'confirm') {
    return (
      <div className="send-money-container">
        <div className="send-money-header">
          <h1>Review & send</h1>
        </div>

        <div className="confirmation-card">
          <div className="recipient-avatar-large" style={{ backgroundColor: '#5B2C9F' }}>
            {recipient.charAt(0).toUpperCase()}
          </div>
          <h2>Send to {recipient}</h2>
          <p className="enrolled-text">Added as {recipient.toUpperCase()}</p>
          
          <div className="amount-display">${amount}</div>

          <div className="detail-row">
            <span>From</span>
            <span>{selectedAccount?.name}</span>
          </div>
          
          {memo && (
            <div className="detail-row">
              <span>Memo</span>
              <span>{memo}</span>
            </div>
          )}

          <div className="detail-row">
            <span>Confirmation</span>
            <span>{confirmationCode}</span>
          </div>

          <p className="availability-text">
            The money will be available in {recipient}'s account typically within minutes.
          </p>
        </div>

        <div className="button-row">
          <button className="action-btn-secondary" onClick={() => setScreen('amount')}>
            Back
          </button>
          <button className="action-btn-primary" onClick={handleSend}>
            Send
          </button>
        </div>
      </div>
    );
  }

  // Success Screen
  if (screen === 'success') {
    return (
      <div className="send-money-container success-screen">
        <div className="success-icon">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="40" fill="#107C41"/>
            <path d="M25 40L35 50L55 30" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1>All set!</h1>
        <h2>Money sent to {recipient}</h2>
        <p className="enrolled-text">Added as {recipient.toUpperCase()}</p>

        <div className="amount-display-large">${amount}</div>

        <div className="detail-section">
          <div className="detail-row">
            <span>From</span>
            <span>{selectedAccount?.name}</span>
          </div>
          
          <div className="detail-row">
            <span>Confirmation</span>
            <span>{confirmationCode}</span>
          </div>

          <p className="availability-text">
            The money will be available in {recipient}'s account typically within minutes.
          </p>
        </div>

        <button className="action-btn-secondary" onClick={() => {
          setScreen('select');
          setAmount('');
          setRecipient('');
          setMemo('');
        }} style={{ width: '300px' }}>
          Done
        </button>
      </div>
    );
  }

  // Verification Code Screen
  if (screen === 'verify') {
    return (
      <div className="send-money-container">
        <div className="verify-header">
          <button
            className="close-btn"
            onClick={() => setScreen('amount')}
            aria-label="Close"
          >
            ✕
          </button>
          <h1>Enter code</h1>
        </div>

        <div className="verification-content">
          <p className="verify-description">
            A code is sent to {formatPhoneForDisplay(recipientPhone)} by text message.
          </p>
          <p className="verify-subtext">
            Please give it a few minutes to arrive.
          </p>

          <div className="form-group">
            <input
              type="text"
              className="code-input"
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength="6"
              inputMode="numeric"
            />
          </div>

          <div className="button-row">
            <button
              className="action-btn-primary"
              onClick={handleVerifyCode}
              disabled={enteredCode.length !== 6}
            >
              Continue
            </button>
            <button className="action-btn-secondary" onClick={() => {
              setVerificationCode('123456');
              setEnteredCode('');
            }}>
              Get a new code
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SendMoneyApp;
