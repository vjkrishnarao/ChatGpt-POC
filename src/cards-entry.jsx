import React from 'react';
import { createRoot } from 'react-dom/client';
import CardsApp from './components/CardsApp';
import './styles/cards.css';

const root = createRoot(document.getElementById('root'));
root.render(<CardsApp />);
