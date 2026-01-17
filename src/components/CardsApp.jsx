import React from 'react';
import CreditCard from './CreditCard';

const CardsApp = () => {
  // Set useSVG to true to use SVG graphics, false to use actual card images
  const useSVG = false;

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
    <div className="cards-container">
      {cardsData.map(card => (
        <CreditCard key={card.id} {...card} useSVG={useSVG} />
      ))}
    </div>
  );
};

export default CardsApp;
