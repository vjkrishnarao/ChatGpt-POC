import React, { useState } from 'react';

const SendMoneyApp = ({ initialAmount = '', initialRecipient = '', startScreen = 'select' }) => {
  const recentRecipients = [
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
  const [recipientPhone, setRecipientPhone] = useState(finalPhone);
  const [recipientName, setRecipientName] = useState(finalRecipient);
  const [fromAccount, setFromAccount] = useState('EVERYDAY CHECKING ...7663');
  const [memo, setMemo] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

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
    setScreen('amount');
  };

  const handleAddRecipient = () => {
    if (recipientName && recipientPhone) {
      setRecipient(recipientName);
      setScreen('amount');
    }
  };

  const handleReview = () => {
    setScreen('confirm');
    setConfirmationCode(`WFCT0ZPT${Math.floor(Math.random() * 10000)}`);
  };

  const handleSend = () => {
    setScreen('success');
  };

  // Select Recipient Screen
  if (screen === 'select') {
    return (
      <div className="send-money-container">
        <div className="send-money-header">
          <h1>Select recipient</h1>
        </div>
        {!hasInitialData && (
          <div className="info-box" style={{ marginTop: 8 }}>
            <span className="info-icon">ⓘ</span>
            <p>
              ChatGPT didn't provide an amount or recipient for this session.
              Please choose who to pay and enter the details manually.
            </p>
          </div>
        )}
        
        <div className="search-section">
          <div className="search-bar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#666" strokeWidth="2"/>
              <path d="M21 21L16.65 16.65" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Add / Search" />
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
          <h3>Recent</h3>
          {recentRecipients.map((rec, idx) => (
            <div key={idx} className="recipient-item" onClick={() => handleSelectRecipient(rec)}>
              <div className="recipient-avatar" style={{ backgroundColor: '#5B2C9F' }}>
                {rec.initial}
                <span className="zelle-badge">Z</span>
              </div>
              <div className="recipient-info">
                <div className="recipient-name">{rec.name}</div>
                <div className="recipient-contact">{rec.phone || rec.email}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="action-btn-secondary" onClick={() => setScreen('add')}>
          Add New Recipient
        </button>
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
          <p>Only use Zelle® to pay people and businesses you know and trust.</p>
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
              <span>Zelle® tag for business</span>
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
              <strong>{recipientName}</strong> must be enrolled with Zelle® using{' '}
              <strong>{recipientPhone}</strong> to receive money.
            </p>
          </div>
        )}

        <p className="terms-text">
          By adding this recipient, you agree to receive text messages about your Zelle® activity. 
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

        <div className="recipient-card">
          <div className="recipient-avatar-large" style={{ backgroundColor: '#5B2C9F' }}>
            {recipient.charAt(0).toUpperCase()}
            <span className="zelle-badge-large">Z</span>
          </div>
          <h2>Send to {recipient}</h2>
          <p className="enrolled-text">Enrolled as {recipient.toUpperCase()}</p>
        </div>

        <div className="amount-input-section">
          <input
            type="text"
            className="amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="$0.00"
          />
          <p className="limits-text">Limits: $3,500.00/day; $18,674.00/30 days <span className="info-icon">ⓘ</span></p>
        </div>

        <div className="form-group">
          <label>Pay from</label>
          <div className="account-selector">
            <div>
              <div className="account-name">{fromAccount}</div>
              <div className="account-balance">Available balance $1,284.94</div>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>
            Memo <span className="optional">(optional)</span>
            <span className="info-icon">ⓘ</span>
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Add a note"
          />
        </div>

        <div className="button-row">
          <button className="action-btn-secondary" onClick={() => setScreen(initialRecipient ? 'select' : 'add')}>
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
          <h1>Confirm payment</h1>
        </div>

        <div className="confirmation-card">
          <div className="recipient-avatar-large" style={{ backgroundColor: '#5B2C9F' }}>
            {recipient.charAt(0).toUpperCase()}
            <span className="zelle-badge-large">Z</span>
          </div>
          <h2>Send to {recipient}</h2>
          <p className="enrolled-text">Enrolled as {recipient.toUpperCase()}</p>
          
          <div className="amount-display">${amount}</div>

          <div className="detail-row">
            <span>From</span>
            <span>{fromAccount}</span>
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
        <p className="enrolled-text">Enrolled as {recipient.toUpperCase()}</p>

        <div className="amount-display-large">${amount}</div>

        <div className="detail-section">
          <div className="detail-row">
            <span>From</span>
            <span>{fromAccount}</span>
          </div>
          
          <div className="detail-row">
            <span>Confirmation</span>
            <span>{confirmationCode}</span>
          </div>

          <p className="availability-text">
            The money will be available in {recipient}'s account typically within minutes.
          </p>
        </div>

        <button className="action-btn-primary-full" onClick={() => {
          setScreen('select');
          setAmount('');
          setRecipient('');
          setMemo('');
        }}>
          Done
        </button>
      </div>
    );
  }

  return null;
};

export default SendMoneyApp;
