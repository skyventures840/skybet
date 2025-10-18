// Performance monitoring utilities for React components

// Performance profiler for components
export const withPerformanceProfiler = (WrappedComponent, componentName) => {
  return React.forwardRef((props, ref) => {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(`${componentName} render time: ${renderTime.toFixed(2)}ms (>16ms threshold)`);
      }
    });
    
    return <WrappedComponent {...props} ref={ref} />;
  });
};

// Debounce utility for expensive operations
export const debounce = (func, wait, immediate) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

// Throttle utility for scroll/resize events
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Memory usage monitor
export const monitorMemoryUsage = () => {
  if (performance.memory) {
    const memory = performance.memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
    };
  }
  return null;
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  const scripts = document.querySelectorAll('script[src]');
  const styles = document.querySelectorAll('link[rel="stylesheet"]');
  
  console.group('Bundle Analysis');
  console.log(`Scripts loaded: ${scripts.length}`);
  console.log(`Stylesheets loaded: ${styles.length}`);
  
  scripts.forEach((script, index) => {
    console.log(`Script ${index + 1}: ${script.src}`);
  });
  
  styles.forEach((style, index) => {
    console.log(`Stylesheet ${index + 1}: ${style.href}`);
  });
  
  console.groupEnd();
};

// Performance metrics collector
export const collectPerformanceMetrics = () => {
  const navigation = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  
  const metrics = {
    // Navigation timing
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    
    // Paint timing
    firstPaint: paint.find(entry => entry.name === 'first-paint')?.startTime || 0,
    firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
    
    // Memory (if available)
    memory: monitorMemoryUsage()
  };
  
  return metrics;
};

// React performance observer
export const usePerformanceObserver = (componentName) => {
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > 16) { // 16ms threshold for 60fps
            console.warn(`${componentName} - Long task detected: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });
      
      observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      
      return () => observer.disconnect();
    }
  }, [componentName]);
};

// Lazy loading utility with intersection observer
export const useLazyLoading = (ref, threshold = 0.1) => {
  const [isVisible, setIsVisible] = React.useState(false);
  
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [ref, threshold]);
  
  return isVisible;
};

// Component render tracker
export const useRenderTracker = (componentName) => {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());
  
  React.useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCount.current} (${timeSinceLastRender}ms since last)`);
    }
  });
  
  return renderCount.current;
};

// Export all utilities
export default {
  withPerformanceProfiler,
  debounce,
  throttle,
  monitorMemoryUsage,
  analyzeBundleSize,
  collectPerformanceMetrics,
  usePerformanceObserver,
  useLazyLoading,
  useRenderTracker
};