import React, { useState } from 'react';
import TermsAndConditions from './TermsAndConditions';

const Footer = () => {
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  return (
    <footer className="footer">
      <div className="container">
        {/* Support and Trust Section */}
        <div className="footer-section">
          <h3 className="footer-title">SUPPORT AND TRUST</h3>
          <ul className="footer-links">
            <li><a href="#" className="footer-link">How to Play</a></li>
            <li><a href="#" className="footer-link" onClick={(e) => {
              e.preventDefault();
              setIsTermsOpen(true);
            }}>Terms and Conditions</a></li>
            <li><a href="#" className="footer-link">Responsible Gambling</a></li>
            <li><a href="#" className="footer-link">Privacy Policy</a></li>
            <li><a href="#" className="footer-link">Cookies Policy</a></li>
            <li><a href="#" className="footer-link">Casino Promotions</a></li>
          </ul>
        </div>
        {/* Legal and Compliance Section */}
        <div className="footer-section">
          <h3 className="footer-title">Legal and Compliance</h3>
          <div className="age-warning">
            <span className="age-badge">18+</span>
            <p>This forum is open only to persons over the age of 18 years. Gambling may have adverse effects if not taken in moderation.</p>
          </div>
        </div>
        {/* Branding and Additional Info */}
        <div className="footer-section text-right">
          <p className="footer-text">
            Gambling can be addictive, please play responsibly. For support, visit our <a href="#" className="footer-link-blue">Responsible Gambling Help</a> page.
          </p>
          <div className="footer-badges">
            <span>Licensed by <strong>MGA</strong></span>
            <span>Certified by <a href="https://ecogra.org/" className="footer-link-blue"><strong>eCOGRA</strong></a></span>
          </div>
          <div className="footer-brand">
            <span>Powered by <strong>Betdev</strong></span>
          </div>
        </div>
      </div>
      
      <TermsAndConditions 
        isOpen={isTermsOpen} 
        onClose={() => setIsTermsOpen(false)} 
      />
    </footer>
  );
};

export default Footer;