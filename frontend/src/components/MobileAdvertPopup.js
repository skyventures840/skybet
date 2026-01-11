import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import enhancedCache from '../services/enhancedCache';

const MobileAdvertPopup = () => {
  const [slide, setSlide] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchSlides = async () => {
      let data = [];
      try {
        const cached = enhancedCache.getCachedData('/admin/hero');
        if (cached && Array.isArray(cached)) data = cached;
      } catch (e) { void e; }
      try {
        const res = await apiService.getHeroSlides();
        data = Array.isArray(res.data) ? res.data : data;
      } catch (e) { void e; }
      const advert = (data || []).find(s => {
        const flag = s.popupAdvert || s.isAdvert || s.tag === 'advert';
        const txt = typeof s.buttonText === 'string' ? s.buttonText.toLowerCase() : '';
        return flag || txt.includes('advert');
      });
      if (!advert) return;
      if (typeof window !== 'undefined' && window.innerWidth <= 767) {
        const key = `mobileAdvertDismissed_${advert.image || advert._id || 'default'}`;
        const dismissed = localStorage.getItem(key) === '1';
        if (!dismissed) {
          setSlide(advert);
          setOpen(true);
        }
      }
    };
    fetchSlides();
  }, []);

  if (!open || !slide) return null;

  const handleClose = () => {
    const key = `mobileAdvertDismissed_${slide.image || slide._id || 'default'}`;
    try { localStorage.setItem(key, '1'); } catch (e) { void e; }
    setOpen(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '92vw',
          maxWidth: 420,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          background: '#000'
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: 'none',
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            fontSize: 20,
            lineHeight: '32px',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
        <img
          src={slide.image}
          alt={slide.caption1 || 'Advert'}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
};

export default MobileAdvertPopup;

