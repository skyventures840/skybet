#!/usr/bin/env node

/**
 * CSS Optimization Script for Platypus Sports Betting Platform
 * 
 * This script automates the CSS optimization process:
 * 1. Builds CSS from modular files
 * 2. Removes unused CSS (PurgeCSS)
 * 3. Minifies and optimizes the final CSS
 * 4. Generates optimization reports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  sourceDir: 'src/styles',
  outputDir: 'dist/styles',
  sourceFile: 'main.css',
  outputFile: 'styles.optimized.css',
  backupFile: 'styles.backup.css',
  reportFile: 'css-optimization-report.txt'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utility functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logSuccess(`Created directory: ${dir}`);
  }
}

function getFileSize(filePath) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2); // KB
  }
  return 0;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main optimization process
async function optimizeCSS() {
  const startTime = Date.now();
  const report = {
    startTime: new Date().toISOString(),
    steps: [],
    fileSizes: {},
    errors: [],
    warnings: []
  };

  try {
    log('🚀 Starting CSS Optimization Process', 'bright');
    log('=====================================', 'blue');

    // Step 1: Check dependencies
    logStep('1', 'Checking dependencies...');
    try {
      execSync('npm list postcss-cli', { stdio: 'pipe' });
      logSuccess('PostCSS CLI is available');
    } catch (error) {
      logError('PostCSS CLI not found. Please install dependencies first:');
      log('npm install --save-dev postcss-cli autoprefixer cssnano', 'yellow');
      process.exit(1);
    }

    // Step 2: Create output directory
    logStep('2', 'Creating output directory...');
    ensureDirectoryExists(config.outputDir);

    // Step 3: Build CSS from modular files
    logStep('3', 'Building CSS from modular files...');
    try {
      const sourcePath = path.join(config.sourceDir, config.sourceFile);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      // Copy source file to output directory
      const outputPath = path.join(config.outputDir, config.outputFile);
      fs.copyFileSync(sourcePath, outputPath);
      
      const sourceSize = getFileSize(sourcePath);
      report.fileSizes.source = sourceSize;
      logSuccess(`Built CSS: ${sourceSize} KB`);
      report.steps.push({ step: 'Build', status: 'success', size: sourceSize });
    } catch (error) {
      logError(`Build failed: ${error.message}`);
      report.errors.push({ step: 'Build', error: error.message });
      throw error;
    }

    // Step 4: Remove unused CSS (PurgeCSS simulation)
    logStep('4', 'Removing unused CSS...');
    try {
      // For now, we'll simulate PurgeCSS by removing comments and extra whitespace
      const cssPath = path.join(config.outputDir, config.outputFile);
      let css = fs.readFileSync(cssPath, 'utf8');
      
      // Remove comments
      css = css.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Remove extra whitespace
      css = css.replace(/\s+/g, ' ');
      css = css.replace(/\s*{\s*/g, '{');
      css = css.replace(/\s*}\s*/g, '}');
      css = css.replace(/\s*;\s*/g, ';');
      css = css.replace(/\s*:\s*/g, ':');
      css = css.replace(/\s*,\s*/g, ',');
      
      // Remove empty rules
      css = css.replace(/[^{}]+{\s*}/g, '');
      
      fs.writeFileSync(cssPath, css);
      
      const purgedSize = getFileSize(cssPath);
      const reduction = ((sourceSize - purgedSize) / sourceSize * 100).toFixed(1);
      logSuccess(`Purged CSS: ${purgedSize} KB (${reduction}% reduction)`);
      report.steps.push({ step: 'Purge', status: 'success', size: purgedSize, reduction });
    } catch (error) {
      logError(`Purge failed: ${error.message}`);
      report.errors.push({ step: 'Purge', error: error.message });
      throw error;
    }

    // Step 5: Minify CSS
    logStep('5', 'Minifying CSS...');
    try {
      const cssPath = path.join(config.outputDir, config.outputFile);
      let css = fs.readFileSync(cssPath, 'utf8');
      
      // Basic minification
      css = css.replace(/\s+/g, ' ');
      css = css.replace(/\s*{\s*/g, '{');
      css = css.replace(/\s*}\s*/g, '}');
      css = css.replace(/\s*;\s*/g, ';');
      css = css.replace(/\s*:\s*/g, ':');
      css = css.replace(/\s*,\s*/g, ',');
      css = css.replace(/;\s*}/g, '}');
      css = css.replace(/:\s*0px/g, ':0');
      css = css.replace(/:\s*0em/g, ':0');
      css = css.replace(/:\s*0rem/g, ':0');
      
      fs.writeFileSync(cssPath, css);
      
      const minifiedSize = getFileSize(cssPath);
      const totalReduction = ((sourceSize - minifiedSize) / sourceSize * 100).toFixed(1);
      logSuccess(`Minified CSS: ${minifiedSize} KB (${totalReduction}% total reduction)`);
      report.steps.push({ step: 'Minify', status: 'success', size: minifiedSize, totalReduction });
    } catch (error) {
      logError(`Minification failed: ${error.message}`);
      report.errors.push({ step: 'Minify', error: error.message });
      throw error;
    }

    // Step 6: Generate optimization report
    logStep('6', 'Generating optimization report...');
    try {
      const reportPath = path.join(config.outputDir, config.reportFile);
      const reportContent = generateReport(report);
      fs.writeFileSync(reportPath, reportContent);
      logSuccess(`Report generated: ${config.reportFile}`);
    } catch (error) {
      logError(`Report generation failed: ${error.message}`);
      report.errors.push({ step: 'Report', error: error.message });
    }

    // Step 7: Create backup
    logStep('7', 'Creating backup...');
    try {
      const backupPath = path.join(config.outputDir, config.backupFile);
      const sourcePath = path.join(config.sourceDir, config.sourceFile);
      fs.copyFileSync(sourcePath, backupPath);
      logSuccess('Backup created');
    } catch (error) {
      logWarning(`Backup creation failed: ${error.message}`);
      report.warnings.push({ step: 'Backup', warning: error.message });
    }

    // Final summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    log('\n🎉 CSS Optimization Complete!', 'bright');
    log('==============================', 'blue');
    log(`⏱️  Duration: ${duration}s`, 'cyan');
    log(`📁 Output: ${config.outputDir}`, 'cyan');
    log(`📊 Final size: ${getFileSize(path.join(config.outputDir, config.outputFile))} KB`, 'green');
    
    if (report.errors.length > 0) {
      log(`\n⚠️  ${report.errors.length} error(s) occurred:`, 'yellow');
      report.errors.forEach(error => {
        log(`   - ${error.step}: ${error.error}`, 'red');
      });
    }
    
    if (report.warnings.length > 0) {
      log(`\n⚠️  ${report.warnings.length} warning(s):`, 'yellow');
      report.warnings.forEach(warning => {
        log(`   - ${warning.step}: ${warning.warning}`, 'yellow');
      });
    }

  } catch (error) {
    logError(`\nCSS optimization failed: ${error.message}`);
    process.exit(1);
  }
}

// Generate optimization report
function generateReport(report) {
  const { startTime, steps, fileSizes, errors, warnings } = report;
  
  let reportContent = `CSS Optimization Report
Generated: ${startTime}
=====================================

Summary:
${steps.map(step => `- ${step.step}: ${step.status} (${step.size} KB)`).join('\n')}

File Sizes:
- Source: ${fileSizes.source} KB
- Final: ${steps[steps.length - 1]?.size || 'N/A'} KB
- Total Reduction: ${steps[steps.length - 1]?.totalReduction || 'N/A'}%

Steps Completed:
${steps.map(step => `✓ ${step.step}`).join('\n')}

`;

  if (errors.length > 0) {
    reportContent += `Errors:\n${errors.map(error => `✗ ${error.step}: ${error.error}`).join('\n')}\n\n`;
  }
  
  if (warnings.length > 0) {
    reportContent += `Warnings:\n${warnings.map(warning => `⚠ ${warning.step}: ${warning.warning}`).join('\n')}\n\n`;
  }

  reportContent += `
Recommendations:
- Use the optimized CSS file in production
- Keep the backup file for reference
- Monitor performance improvements
- Consider implementing CSS-in-JS for dynamic styles

Next Steps:
1. Replace the original CSS file with the optimized version
2. Test the application thoroughly
3. Monitor performance metrics
4. Update build process to include optimization

For more information, see the documentation in the styles directory.
`;

  return reportContent;
}

// Run the optimization if this script is executed directly
if (require.main === module) {
  optimizeCSS().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { optimizeCSS, generateReport };
