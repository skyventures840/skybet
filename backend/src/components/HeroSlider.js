import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

const HeroSlider = () => {
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [error, setError] = useState(null);

  // Preload cached slides for instant render
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cache:/admin/hero');
      if (raw) {
        const entry = JSON.parse(raw);
        const cachedSlides = entry?.data || [];
        if (Array.isArray(cachedSlides) && cachedSlides.length > 0) {
          setSlides(cachedSlides);
        }
      }
    } catch (_) {
      // ignore cache errors
    }
  }, []);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const response = await apiService.getHeroSlides();
        setSlides(response.data);
      } catch (err) {
        setError('Failed to load hero slides');
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
  if (slides.length === 0) {
    return <div className="hero-slider"><div className="slider-container"><p>No hero slides available.</p></div></div>;
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
                <a href={slide.buttonUrl} target="_blank" rel="noopener noreferrer">
                  <button className="slide-cta">{slide.buttonText}</button>
                </a>
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