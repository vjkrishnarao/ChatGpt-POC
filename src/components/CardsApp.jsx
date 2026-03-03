import React, { useState, useEffect } from 'react';
import CreditCard from './CreditCard';

const CardsApp = () => {
  // Set useSVG to true to use SVG graphics, false to use actual card images
  const useSVG = false;
  const [learnMoreModal, setLearnMoreModal] = useState({ isOpen: false, content: '' });
  const [termsModal, setTermsModal] = useState({ isOpen: false, content: '' });

  // Listen for display mode changes to auto-close modal when fullscreen exits
  useEffect(() => {
    const handleDisplayModeChange = (event) => {
      const displayMode = event.detail?.globals?.displayMode || window.openai?.displayMode;
      
      // If display mode changes away from fullscreen, close the modals
      if (displayMode !== 'fullscreen') {
        if (learnMoreModal.isOpen) {
          setLearnMoreModal({ isOpen: false, content: '' });
        }
        if (termsModal.isOpen) {
          setTermsModal({ isOpen: false, content: '' });
        }
      }
    };

    window.addEventListener('openai:set_globals', handleDisplayModeChange, { passive: true });
    
    return () => {
      window.removeEventListener('openai:set_globals', handleDisplayModeChange);
    };
  }, [learnMoreModal.isOpen, termsModal.isOpen]);

  const handleOpenLearnMore = async (title) => {
    // Request fullscreen mode in ChatGPT
    await window.openai?.requestDisplayMode({ mode: "fullscreen", showHeader: false, showCloseButton: false });
    
    setLearnMoreModal({
      isOpen: true,
      content: `Our credit cards are designed to reward your everyday spending with exceptional benefits and flexible payment options. Whether you're earning cash back on purchases, enjoying low introductory APR periods, or maximizing rewards on travel and dining, we have a card that fits your lifestyle. All our cards come with no annual fee for the first year, comprehensive fraud protection, and 24/7 customer support to ensure your financial security.

With our mobile app, you can easily track your spending, monitor rewards, set up payment reminders, and access your account anytime, anywhere. We're committed to providing transparent terms with no hidden fees, and our dedicated team is always ready to help you make the most of your card benefits. Plus, cardholders enjoy exclusive access to special offers, extended warranties on purchases, and travel insurance coverage for added peace of mind.`
    });
  };

  const handleCloseLearnMore = async () => {
    await window.openai?.requestDisplayMode({ mode: "inline" });
    setLearnMoreModal({ isOpen: false, content: '' });
  };

  const handleOpenTermsFromLearnMore = async () => {
    // Hide the system close button while showing React modal
    await window.openai?.requestDisplayMode({ mode: "fullscreen", showHeader: false, showCloseButton: false });
    
    setTermsModal({
      isOpen: true,
      content: `**Annual Percentage Rate (APR):** Variable APR of 18.99% - 29.99% based on creditworthiness. Introductory APR of 0% for the first 15 months on purchases and balance transfers, then the variable APR applies. Cash advances subject to a 27.99% APR.

**Fees:** No annual fee for the first year, then $95 annually. Balance transfer fee of 3% of the amount transferred (minimum $5). Cash advance fee of 5% of the amount advanced (minimum $10). Foreign transaction fee of 3% of each transaction in U.S. dollars. Late payment fee up to $40. Returned payment fee up to $40.

**Credit Limit:** Your credit limit will be determined based on your creditworthiness and income at the time of application. Minimum credit limit of $500. Credit limit increases may be considered after 6 months of responsible account management.

**Rewards Program:** Earn rewards on eligible purchases. Rewards do not expire as long as your account remains open and in good standing. Rewards may be redeemed for statement credits, gift cards, merchandise, or travel. Maximum rewards earning is capped at $25,000 in combined purchases per calendar year.

**Payment Terms:** Minimum payment due is either $35 or 1% of your new balance plus interest charges and late fees, whichever is greater. Payment is due by 5 PM ET on the due date. Grace period of at least 21 days on purchases when you pay your balance in full each billing cycle.

**Account Changes:** We reserve the right to change your APR, credit limit, or other account terms with 45 days advance notice as permitted by law. Your account is subject to periodic review and terms may be adjusted based on your payment history and credit profile.`
    });
  };

  const handleOpenTerms = async (title) => {
    setTermsModal({
      isOpen: true,
      content: `**Annual Percentage Rate (APR):** Variable APR of 18.99% - 29.99% based on creditworthiness. Introductory APR of 0% for the first 15 months on purchases and balance transfers, then the variable APR applies. Cash advances subject to a 27.99% APR.

**Fees:** No annual fee for the first year, then $95 annually. Balance transfer fee of 3% of the amount transferred (minimum $5). Cash advance fee of 5% of the amount advanced (minimum $10). Foreign transaction fee of 3% of each transaction in U.S. dollars. Late payment fee up to $40. Returned payment fee up to $40.

**Credit Limit:** Your credit limit will be determined based on your creditworthiness and income at the time of application. Minimum credit limit of $500. Credit limit increases may be considered after 6 months of responsible account management.

**Rewards Program:** Earn rewards on eligible purchases. Rewards do not expire as long as your account remains open and in good standing. Rewards may be redeemed for statement credits, gift cards, merchandise, or travel. Maximum rewards earning is capped at $25,000 in combined purchases per calendar year.

**Payment Terms:** Minimum payment due is either $35 or 1% of your new balance plus interest charges and late fees, whichever is greater. Payment is due by 5 PM ET on the due date. Grace period of at least 21 days on purchases when you pay your balance in full each billing cycle.

**Account Changes:** We reserve the right to change your APR, credit limit, or other account terms with 45 days advance notice as permitted by law. Your account is subject to periodic review and terms may be adjusted based on your payment history and credit profile.`
    });
  };

  const handleCloseTerms = async () => {
    // Show the system close button again
    await window.openai?.requestDisplayMode({ mode: "fullscreen", showHeader: false, showCloseButton: false });
    setTermsModal({ isOpen: false, content: '' });
  };

  const handleOpenOpenAIModal = async () => {
    await window.openai?.requestModal({
      template: "ui://widget/terms-modal.html"
    });
  };

  const cardsData = [
    {
      id: 1,
      cardType: 'active-cash',
      label: 'Popular for cash rewards',
      title: 'Active Cash® Card',
      description: 'Earn unlimited 2% cash rewards on purchases<sup>1</sup>',
      termsLink: 'https://www.wellsfargo.com/credit-cards/active-cash/terms/',
      applyLink: 'https://apply.wellsfargo.com/getting_started',
      learnLink: 'https://creditcards.wellsfargo.com/active-cash-credit-card/'
    },
    {
      id: 2,
      cardType: 'reflect',
      label: 'Popular for low intro APR',
      title: 'Reflect® Card',
      description: 'Low intro APR for 21 months from account opening',
      termsLink: 'https://www.wellsfargo.com/credit-cards/reflect-visa/terms/',
      applyLink: 'https://apply.wellsfargo.com/getting_started',
      learnLink: 'https://creditcards.wellsfargo.com/reflect-visa-credit-card/'
    },
    {
      id: 3,
      cardType: 'autograph',
      label: 'Popular for everyday purchases',
      title: 'Autograph® Card',
      description: 'Earn 3X points for many ways to keep life in motion<sup>6</sup>',
      termsLink: 'https://www.wellsfargo.com/credit-cards/autograph-visa/terms/',
      applyLink: 'https://apply.wellsfargo.com/getting_started',
      learnLink: 'https://creditcards.wellsfargo.com/autograph-visa-credit-card/'
    }
  ];

  return (
    <>
      <div className="cards-container">
        {cardsData.map(card => (
          <CreditCard key={card.id} {...card} useSVG={useSVG} onOpenLearnMore={handleOpenLearnMore} onOpenTerms={handleOpenTerms} />
        ))}
      </div>
      
      {learnMoreModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body">
              <p className="modal-content-text">{learnMoreModal.content}</p>
              <a href="#" className="modal-terms-link" onClick={(e) => { e.preventDefault(); handleOpenTermsFromLearnMore(); }}>
                Terms and Conditions React Modal
              </a>
              <br />
              <a href="#" className="modal-terms-link" onClick={(e) => { e.preventDefault(); handleOpenOpenAIModal(); }}>
                Terms and Conditions OpenAI Native Modal
              </a>
            </div>
          </div>
        </div>
      )}

      {termsModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseTerms}>
          <div className="modal-content modal-content-centered" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseTerms}>×</button>
            <div className="modal-body">
              <h2 className="modal-content-header">Terms and Conditions</h2>
              <p className="modal-content-text">{termsModal.content}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CardsApp;
