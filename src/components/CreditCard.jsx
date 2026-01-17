import React from 'react';

// Import plain card images (without names)
import activeCashImg from '../images/active-cash-plain.svg';
import reflectImg from '../images/reflect-plain.svg';
import autographImg from '../images/autograph-plain.svg';

const CreditCard = ({ label, title, description, cardType, termsLink, applyLink, learnLink, useSVG = false }) => {
  
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
        <a href={termsLink} className="card-terms" target="_blank" rel="noopener noreferrer">
          Important credit terms
        </a>
        <div className="card-buttons">
          {/* <a href={applyLink} className="btn btn-primary">Apply now</a> */}
          <a href={learnLink} className="btn btn-primary">Learn more</a>
        </div>
      </div>
    </div>
  );
};

export default CreditCard;
