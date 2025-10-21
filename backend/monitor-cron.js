const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class CronMonitor {
  constructor() {
    this.cronProcess = null;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.restartDelay = 5000; // 5 seconds
    this.healthCheckInterval = 30000; // 30 seconds
    this.logFile = path.join(__dirname, 'cron-monitor.log');
    this.isShuttingDown = false;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    
    // Append to log file
    fs.appendFileSync(this.logFile, logMessage);
  }

  startCronJobs() {
    if (this.cronProcess) {
      this.log('Cron jobs already running, skipping start');
      return;
    }

    this.log('Starting cron jobs...');
    
    const cronScript = path.join(__dirname, 'run-cron.js');
    this.cronProcess = spawn('node', [cronScript], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.cronProcess.stdout.on('data', (data) => {
      this.log(`CRON STDOUT: ${data.toString().trim()}`);
    });

    this.cronProcess.stderr.on('data', (data) => {
      this.log(`CRON STDERR: ${data.toString().trim()}`);
    });

    this.cronProcess.on('close', (code) => {
      this.log(`Cron process exited with code ${code}`);
      this.cronProcess = null;
      
      if (!this.isShuttingDown) {
        this.handleCronExit(code);
      }
    });

    this.cronProcess.on('error', (error) => {
      this.log(`Cron process error: ${error.message}`);
      this.cronProcess = null;
      
      if (!this.isShuttingDown) {
        this.handleCronExit(1);
      }
    });

    this.log('Cron jobs started successfully');
  }

  handleCronExit(code) {
    if (this.restartCount >= this.maxRestarts) {
      this.log(`Maximum restart attempts (${this.maxRestarts}) reached. Stopping monitor.`);
      process.exit(1);
    }

    this.restartCount++;
    this.log(`Cron jobs stopped unexpectedly (code: ${code}). Restarting in ${this.restartDelay}ms... (attempt ${this.restartCount}/${this.maxRestarts})`);
    
    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.startCronJobs();
      }
    }, this.restartDelay);
  }

  performHealthCheck() {
    if (!this.cronProcess) {
      this.log('Health check failed: No cron process running');
      return false;
    }

    // Check if process is still alive
    try {
      process.kill(this.cronProcess.pid, 0);
      this.log('Health check passed: Cron process is running');
      return true;
    } catch (error) {
      this.log('Health check failed: Cron process is not responding');
      this.cronProcess = null;
      return false;
    }
  }

  startHealthChecks() {
    setInterval(() => {
      if (!this.performHealthCheck() && !this.isShuttingDown) {
        this.log('Health check failed, restarting cron jobs...');
        this.handleCronExit(1);
      }
    }, this.healthCheckInterval);
    
    this.log(`Health checks started (interval: ${this.healthCheckInterval}ms)`);
  }

  shutdown() {
    this.isShuttingDown = true;
    this.log('Shutting down cron monitor...');
    
    if (this.cronProcess) {
      this.log('Terminating cron process...');
      this.cronProcess.kill('SIGTERM');
      
      // Force kill after 10 seconds if not terminated
      setTimeout(() => {
        if (this.cronProcess) {
          this.log('Force killing cron process...');
          this.cronProcess.kill('SIGKILL');
        }
      }, 10000);
    }
  }

  start() {
    this.log('=== Cron Monitor Starting ===');
    this.log(`Max restarts: ${this.maxRestarts}`);
    this.log(`Restart delay: ${this.restartDelay}ms`);
    this.log(`Health check interval: ${this.healthCheckInterval}ms`);
    
    // Handle process signals
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down...');
      this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down...');
      this.shutdown();
      process.exit(0);
    });

    // Start cron jobs and health checks
    this.startCronJobs();
    this.startHealthChecks();
    
    this.log('Cron monitor is now running');
  }
}

// Start the monitor if this script is run directly
if (require.main === module) {
  const monitor = new CronMonitor();
  monitor.start();
}

module.exports = CronMonitor;