import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SportFallback = ({ sport }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Mapping for sport name variations to ensure correct filtering
  const sportNameMapping = {
    'Football': 'Football / Soccer',
    'Soccer': 'Football / Soccer',
    'Basketball': 'Basketball',
    'Tennis': 'Tennis',
    'Baseball': 'Baseball',
    'Hockey': 'Hockey',
    'Ice Hockey': 'Ice Hockey'
  };

  useEffect(() => {
    // Extract subcategory from the URL path
    const pathSegments = location.pathname.split('/');
    const subcategory = pathSegments[pathSegments.length - 1];
    const mainSport = pathSegments[1]; // Get the main sport from URL (e.g., 'soccer' from '/soccer/epl')
    
    console.log(`Subcategory "${subcategory}" not found in ${mainSport}, redirecting to ${sport} on home page`);
    
    // Navigate to home page
    navigate('/', { replace: true });
    
    // Apply sport filter after navigation
    setTimeout(() => {
      // Use mapped sport name for better filtering
      const mappedSportName = sportNameMapping[sport] || sport;
      
      // Dispatch main sport filter event
      window.dispatchEvent(new CustomEvent('sidebarFilter', { 
        detail: { filter: mappedSportName } 
      }));
      
      // Also dispatch subcategory filter if we want to attempt filtering by subcategory name
      if (subcategory && subcategory !== mainSport) {
        const formattedSubcategory = subcategory
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
          
        console.log(`Attempting to filter by subcategory: ${formattedSubcategory}`);
        
        window.dispatchEvent(new CustomEvent('subcategoryFilter', { 
          detail: { 
            sport: mappedSportName,
            subcategory: formattedSubcategory
          } 
        }));
      }
    }, 100);
  }, [navigate, location.pathname, sport]);

  // Add global CSS for spinner animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes sportFallbackSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="sport-fallback-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px',
      backgroundColor: '#f8f9fa',
      padding: '20px'
    }}>
      <div className="fallback-message" style={{
        textAlign: 'center',
        padding: '30px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxWidth: '300px'
      }}>
        <div style={{
          width: '30px',
          height: '30px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #007bff',
          borderRadius: '50%',
          animation: 'sportFallbackSpin 1s linear infinite',
          margin: '0 auto 15px'
        }}></div>
        <p style={{ 
          margin: '0', 
          color: '#666',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Subcategory not found.<br/>
          Redirecting to {sport} matches...
        </p>
      </div>
    </div>
  );
};

export default SportFallback; 