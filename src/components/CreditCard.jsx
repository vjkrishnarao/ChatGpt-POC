import React from 'react';

// Import plain card images (without names)
import activeCashImg from '../images/active-cash-plain.svg';
import reflectImg from '../images/reflect-plain.svg';
import autographImg from '../images/autograph-plain.svg';

const CreditCard = ({ label, title, description, cardType, termsLink, applyLink, learnLink, useSVG = false, onOpenTerms, onOpenLearnMore }) => {
  
  const handleApplyClick = (e) => {
    e.preventDefault();
    
    // Open in new browser window/tab
    window.open('https://connect.secure.wellsfargo.com/auth/login/ulink?origin=cob&serviceType=eConsent&requestId=10Gs7AVf3T&signonContext=V1', '_blank', 'noopener,noreferrer');
  };

  const handleLearnClick = (e) => {
    e.preventDefault();
    if (onOpenLearnMore) {
      onOpenLearnMore(title);
    }
  };

  const handleTermsClick = (e) => {
    e.preventDefault();
    if (onOpenTerms) {
      onOpenTerms(title);
    }
  };
  
  const getCardImage = () => {
    const imageMap = {
      'active-cash': activeCashImg,
      'reflect': reflectImg,
      'autograph': autographImg
    };
    return imageMap[cardType];
  };

  const renderCardImage = () => {
    // Use the plain SVG images from the images folder
    return <img src={getCardImage()} alt={`${title} card`} className="card-image" />;
  };

  return (
    <div className="card">
      <div className="card-image-wrapper">
        {renderCardImage()}
      </div>
      <div className="card-content">
        {/* <p className="card-label">{label}</p> */}
        <h2 className="card-title">{title}</h2>
        <p className="card-description" dangerouslySetInnerHTML={{ __html: description }} />
        <a href="#" className="card-terms" onClick={handleTermsClick}>
          Important credit terms
        </a>
        <div className="card-buttons">
          <button onClick={handleApplyClick} className="btn btn-primary">Apply now</button>
          <button onClick={handleLearnClick} className="btn btn-secondary">Learn more</button>
        </div>
      </div>
    </div>
  );
};

export default CreditCard;
