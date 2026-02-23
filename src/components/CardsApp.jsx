import React, { useState } from 'react';
import CreditCard from './CreditCard.jsx';

const CardsApp = () => {
  // Set useSVG to true to use SVG graphics, false to use actual card images
  const useSVG = false;
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ cardName: '', termsContent: '' });

  const cardsData = [
    {
      id: 1,
      cardType: 'active-cash',
      label: 'Popular for cash rewards',
      title: 'Active Cash® Card',
      description: 'Earn unlimited 2% cash rewards on purchases<sup>1</sup>',
      applyLink: 'https://apply.wellsfargo.com/getting_started',
      learnLink: 'https://creditcards.wellsfargo.com/active-cash-credit-card/'
    },
    {
      id: 2,
      cardType: 'reflect',
      label: 'Popular for low intro APR',
      title: 'Reflect® Card',
      description: 'Low intro APR for 21 months from account opening',
      applyLink: 'https://apply.wellsfargo.com/getting_started',
      learnLink: 'https://creditcards.wellsfargo.com/reflect-visa-credit-card/'
    },
    {
      id: 3,
      cardType: 'autograph',
      label: 'Popular for everyday purchases',
      title: 'Autograph® Card',
      description: 'Earn 3X points for many ways to keep life in motion<sup>6</sup>',
      applyLink: 'https://apply.wellsfargo.com/getting_started',
      learnLink: 'https://creditcards.wellsfargo.com/autograph-visa-credit-card/'
    }
  ];

  const handleOpenTerms = async (cardName) => {
    try {
      const result = await window.openai.callTool('open_credit_card_terms', { cardName });
      console.log('Tool invoked successfully:', result);
      
      // Extract structured content from the tool response
      if (result?.structuredContent) {
        setModalContent(result.structuredContent);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error invoking tool:', error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <div className="cards-container">
        {cardsData.map(card => (
          <CreditCard 
            key={card.id} 
            {...card} 
            useSVG={useSVG}
            onOpenTerms={handleOpenTerms}
          />
        ))}
      </div>

      {showModal && (
        <div className="terms-modal-overlay" onClick={handleCloseModal}>
          <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="terms-modal-close" onClick={handleCloseModal}>×</button>
            <h2>{modalContent.cardName} - Credit Terms</h2>
            <div className="terms-modal-body">
              <p>{modalContent.termsContent}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CardsApp;
