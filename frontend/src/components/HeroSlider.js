import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import enhancedCache from '../services/enhancedCache';
import SkeletonLoader from './SkeletonLoader';

const HeroSlider = () => {
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        try {
          const cached = enhancedCache.getCachedData('/admin/hero');
          if (cached && Array.isArray(cached) && cached.length > 0) {
            setSlides(cached);
            setLoading(false);
          }
        } catch (e) { void e; }
        const response = await apiService.getHeroSlides();
        const data = Array.isArray(response.data) ? response.data : [];
        if (data.length > 0) setSlides(data);
      } catch (err) {
        setError('');
      } finally {
        setLoading(false);
      }
    };
    fetchSlides();
  }, []);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  if (error) {
    return <div className="hero-slider"><div className="slider-container"><p>{error}</p></div></div>;
  }
  if (loading && slides.length === 0) {
    return (
      <div className="hero-slider">
        <div className="slider-container">
          <SkeletonLoader type="generic" count={1} />
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="hero-slider">
      <div className="slider-container">
        <div 
          className="slides-wrapper"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div key={slide._id || slide.id || index} className="slide">
              <div className="slide-background">
                <img src={slide.image} alt={slide.caption1} />
                <div className="slide-overlay"></div>
              </div>
              <div className="slide-content">
                <h2 className="slide-title">{slide.caption1}</h2>
                <p className="slide-subtitle">{slide.caption2}</p>
                {(slide.buttonText && slide.buttonUrl) ? (
                  <a href={slide.buttonUrl} target="_blank" rel="noopener noreferrer">
                    <button className="slide-cta">{slide.buttonText}</button>
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <button className="slider-btn prev-btn" onClick={prevSlide}>
          ‹
        </button>
        <button className="slider-btn next-btn" onClick={nextSlide}>
          ›
        </button>

        <div className="slider-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSlider;
