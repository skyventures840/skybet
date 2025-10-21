// Performance testing utility for the optimized application
import { collectPerformanceMetrics, monitorMemoryUsage, analyzeBundleSize } from './performance';

class PerformanceTest {
  constructor() {
    this.results = {
      componentRenderTimes: {},
      apiResponseTimes: {},
      memoryUsage: [],
      bundleAnalysis: null,
      overallMetrics: null
    };
    this.startTime = performance.now();
  }

  // Test component render performance
  async testComponentPerformance(componentName, renderFunction) {
    const startTime = performance.now();
    
    try {
      await renderFunction();
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      this.results.componentRenderTimes[componentName] = {
        renderTime,
        status: renderTime < 16 ? 'PASS' : 'WARN',
        threshold: 16
      };
      
      console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
      return renderTime;
    } catch (error) {
      this.results.componentRenderTimes[componentName] = {
        renderTime: -1,
        status: 'ERROR',
        error: error.message
      };
      console.error(`Error testing ${componentName}:`, error);
      return -1;
    }
  }

  // Test API response times
  async testApiPerformance(endpoint, requestFunction) {
    const startTime = performance.now();
    
    try {
      const response = await requestFunction();
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      this.results.apiResponseTimes[endpoint] = {
        responseTime,
        status: responseTime < 1000 ? 'PASS' : 'WARN',
        threshold: 1000,
        statusCode: response?.status || 'unknown'
      };
      
      console.log(`${endpoint} response time: ${responseTime.toFixed(2)}ms`);
      return responseTime;
    } catch (error) {
      this.results.apiResponseTimes[endpoint] = {
        responseTime: -1,
        status: 'ERROR',
        error: error.message
      };
      console.error(`Error testing ${endpoint}:`, error);
      return -1;
    }
  }

  // Monitor memory usage over time
  startMemoryMonitoring(interval = 5000) {
    const monitor = () => {
      const memory = monitorMemoryUsage();
      if (memory) {
        this.results.memoryUsage.push({
          timestamp: Date.now(),
          ...memory
        });
        
        // Alert if memory usage is high
        if (memory.used > memory.limit * 0.8) {
          console.warn(`High memory usage detected: ${memory.used}MB / ${memory.limit}MB`);
        }
      }
    };

    monitor(); // Initial measurement
    const intervalId = setInterval(monitor, interval);
    
    return () => clearInterval(intervalId);
  }

  // Test bundle size and loading performance
  testBundlePerformance() {
    this.results.bundleAnalysis = analyzeBundleSize();
    
    // Check for large bundles
    const scripts = document.querySelectorAll('script[src]');
    const largeScripts = [];
    
    scripts.forEach(script => {
      // This is a simplified check - in real scenarios you'd fetch actual sizes
      if (script.src.includes('chunk') || script.src.includes('vendor')) {
        largeScripts.push(script.src);
      }
    });
    
    if (largeScripts.length > 5) {
      console.warn(`Many script chunks detected (${largeScripts.length}). Consider bundle optimization.`);
    }
    
    return this.results.bundleAnalysis;
  }

  // Test lazy loading effectiveness
  async testLazyLoading() {
    const lazyComponents = document.querySelectorAll('[data-lazy]');
    const results = {
      totalLazyComponents: lazyComponents.length,
      loadedComponents: 0,
      avgLoadTime: 0
    };
    
    const loadTimes = [];
    
    for (const component of lazyComponents) {
      const startTime = performance.now();
      
      // Simulate scrolling into view
      component.scrollIntoView();
      
      // Wait for component to load
      await new Promise(resolve => {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            const endTime = performance.now();
            loadTimes.push(endTime - startTime);
            results.loadedComponents++;
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(component);
      });
    }
    
    results.avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length || 0;
    
    console.log(`Lazy loading test: ${results.loadedComponents}/${results.totalLazyComponents} components loaded`);
    console.log(`Average load time: ${results.avgLoadTime.toFixed(2)}ms`);
    
    return results;
  }

  // Collect overall performance metrics
  collectOverallMetrics() {
    this.results.overallMetrics = collectPerformanceMetrics();
    
    const testDuration = performance.now() - this.startTime;
    this.results.overallMetrics.testDuration = testDuration;
    
    return this.results.overallMetrics;
  }

  // Generate performance report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testDuration: performance.now() - this.startTime,
      summary: {
        totalComponentTests: Object.keys(this.results.componentRenderTimes).length,
        totalApiTests: Object.keys(this.results.apiResponseTimes).length,
        memorySnapshots: this.results.memoryUsage.length,
        overallStatus: 'PASS'
      },
      details: this.results
    };
    
    // Determine overall status
    const hasErrors = Object.values(this.results.componentRenderTimes).some(r => r.status === 'ERROR') ||
                     Object.values(this.results.apiResponseTimes).some(r => r.status === 'ERROR');
    
    const hasWarnings = Object.values(this.results.componentRenderTimes).some(r => r.status === 'WARN') ||
                       Object.values(this.results.apiResponseTimes).some(r => r.status === 'WARN');
    
    if (hasErrors) {
      report.summary.overallStatus = 'ERROR';
    } else if (hasWarnings) {
      report.summary.overallStatus = 'WARN';
    }
    
    return report;
  }

  // Run comprehensive performance test suite
  async runFullTestSuite() {
    console.log('🚀 Starting comprehensive performance test suite...');
    
    // Start memory monitoring
    const stopMemoryMonitoring = this.startMemoryMonitoring();
    
    try {
      // Test bundle performance
      console.log('📦 Testing bundle performance...');
      this.testBundlePerformance();
      
      // Test lazy loading
      console.log('⏳ Testing lazy loading...');
      await this.testLazyLoading();
      
      // Collect overall metrics
      console.log('📊 Collecting performance metrics...');
      this.collectOverallMetrics();
      
      // Generate final report
      const report = this.generateReport();
      
      console.log('✅ Performance test suite completed!');
      console.log('📋 Performance Report:', report);
      
      return report;
      
    } finally {
      // Stop memory monitoring
      stopMemoryMonitoring();
    }
  }
}

// Export for use in components
export default PerformanceTest;

// Utility function to run quick performance check
export const runQuickPerformanceCheck = async () => {
  const test = new PerformanceTest();
  
  // Quick memory check
  const memory = monitorMemoryUsage();
  if (memory && memory.used > memory.limit * 0.7) {
    console.warn('⚠️ High memory usage detected:', memory);
  }
  
  // Quick bundle check
  test.testBundlePerformance();
  
  // Quick metrics collection
  const metrics = test.collectOverallMetrics();
  
  console.log('⚡ Quick performance check completed:', {
    memory,
    firstContentfulPaint: metrics.firstContentfulPaint,
    domContentLoaded: metrics.domContentLoaded
  });
  
  return { memory, metrics };
};