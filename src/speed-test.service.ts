import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as speedTest from 'speedtest-net';
import { readFileSync, writeFileSync } from 'fs';
import { LocationJSON, SpeedTestProgress, SpeedTestResult } from './result.model';
import * as os from 'os';

@Injectable()
export class SpeedTestService {
  /**
   * Store results of speed tests with and without VPN
   * This will be saved to the output file at the end of the tests
   */
  results: SpeedTestResult = {
    MachineName: os.hostname(),
    OS: os.platform(),
    WithoutVPN: {
      LocationName: '',
      TimeToConnect: 0,
      VPNSpeedDownload: 0,
      VPNSpeedUpload: 0,
    },
    WithVPN: [],
    error: '',
  };

  /**
   * Stores the full, detailed results from each speed test
   * This includes all server information and detailed metrics
   */
  fullResults: any[] = [];

  /**
   * Promisified version of the exec function for async/await usage
   */
  execAsync = promisify(exec);

  /**
   * Gets a list of all available VPN locations from ExpressVPN
   * Saves the output to a file for reference
   */
  async getVpnLocations(): Promise<void> {
    try {
      const { stdout, stderr } = await this.execAsync('expressvpn list all');
      writeFileSync('vpn-locations.txt', stdout);

      if (stderr) {
        console.warn(stderr);
      }
    } catch (error) {
      console.error('Error getting VPN locations:', error);
    }
  }

  /**
   * Main method to run the complete speed test workflow
   * 1. Runs baseline test without VPN
   * 2. Tests each location from the input file
   * 3. For each location, runs 5 speed tests and takes average
   * 4. Saves results to output files
   */
  async runSpeedTest(): Promise<void> {
    // Load VPN locations from input file
    let locations: string[];
    try {
      const locationsInput = JSON.parse(readFileSync('data/input.json', 'utf8'));
      locations = this.parseLocations(locationsInput);
    } catch (error) {
      console.error('Error reading input locations file:', error);
      return;
    }

    // Run baseline test without VPN
    console.log('Running base speed test without VPN');
    try {
      const result = await this.getSpeedTestResult();

      this.results.WithoutVPN = {
        LocationName: result.location,
        TimeToConnect: result.latency,
        VPNSpeedDownload: result.downloadSpeed,
        VPNSpeedUpload: result.uploadSpeed,
      };
      console.log('Base speed test finished!');
    } catch (error) {
      this.results.error = 'Error running base speed test';
      return;
    }

    // Test each VPN location
    for (const location of locations) {
      const speedTestsProgress: SpeedTestProgress[] = [];

      // Connect to the VPN location
      try {
        await this.connectToVpn(location);
      } catch (error) {
        console.error('Error connecting to VPN:', error);
        speedTestsProgress.push({
          location: '',
          downloadSpeed: 0,
          uploadSpeed: 0,
          progress: 0,
          latency: 0,
          error: `Unable to connect to ${location}`,
        });
        continue;
      }

      // Run 5 speed tests for more accurate results
      for (let i = 0; i < 5; i++) {
        console.log(`Running speed test ${i + 1}...`);
        try {
          const vpnResult = await this.getSpeedTestResult();
          speedTestsProgress.push(vpnResult);

          // After the last test, calculate averages and add to results
          if (i === 4) {
            this.results.WithVPN.push({
              LocationName: location,
              TimeToConnect: Number((speedTestsProgress.reduce((avg, progress) => avg + progress.latency, 0) / speedTestsProgress.length).toFixed(2)),
              VPNSpeedDownload: Number((speedTestsProgress.reduce((avg, progress) => avg + progress.downloadSpeed, 0) / speedTestsProgress.length).toFixed(2)),
              VPNSpeedUpload: Number((speedTestsProgress.reduce((avg, progress) => avg + progress.uploadSpeed, 0) / speedTestsProgress.length).toFixed(2)),
            });
          }
        } catch (error) {
          speedTestsProgress.push({
            location: '',
            downloadSpeed: 0,
            uploadSpeed: 0,
            progress: 0,
            latency: 0,
            error: error.message,
          });
          console.error('Error running speed test:', error);
        }
      }

      // Disconnect from VPN before testing next location
      await this.disconnectFromVpn();
    }

    // Format results for human-readable output with units
    const mappedResult = {
      ...this.results,
      WithoutVPN: {
        ...this.results.WithoutVPN,
        TimeToConnect: `${this.results.WithoutVPN.TimeToConnect} ms`,
        VPNSpeedDownload: `${this.results.WithoutVPN.VPNSpeedDownload} Mbps`,
        VPNSpeedUpload: `${this.results.WithoutVPN.VPNSpeedUpload} Mbps`,
      },
      WithVPN: this.results.WithVPN.map((vpn) => ({
        ...vpn,
        TimeToConnect: `${vpn.TimeToConnect} ms`,
        VPNSpeedDownload: `${vpn.VPNSpeedDownload} Mbps`,
        VPNSpeedUpload: `${vpn.VPNSpeedUpload} Mbps`,
      })),
    };

    // Save results to output files
    writeFileSync('data/output.json', JSON.stringify(mappedResult, null, 2));
    writeFileSync('data/output-full.json', JSON.stringify(this.fullResults, null, 2));

    console.log('Finished running speed tests! Please verify output files from data folder. Here is a preview of your results:', mappedResult);
  }

  /**
   * Runs a single speed test and returns the progress result
   * Uses the speedtest-net library to measure download, upload, and latency
   * @returns Speed test progress with download, upload, and latency measurements
   */
  async getSpeedTestResult(): Promise<SpeedTestProgress> {
    const speedTestProgress: SpeedTestProgress = {
      location: '',
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      latency: 0,
      error: '',
    };

    // Run the speed test with the speedtest-net library
    const result = await speedTest({
      acceptLicense: true,
      acceptGdpr: true,
      progress: (progress) => {
        if (progress) {
          // Process download speed data
          if (progress.type === 'download') {
            speedTestProgress.downloadSpeed = Number((progress.download.bandwidth / 125000).toFixed(2));
            speedTestProgress.progress = Math.round((progress.download.progress || 0) * 100 * 0.5);
          }

          // Process upload speed data
          if (progress.type === 'upload') {
            speedTestProgress.uploadSpeed = Number((progress.upload.bandwidth / 125000).toFixed(2));
            speedTestProgress.progress = Math.round((progress.upload.progress || 0) * 100 * 0.5) + 50;
          }

          // Process ping/latency data
          if (progress.type === 'ping') {
            speedTestProgress.latency = progress.ping.latency;
          }
        }
      },
    });

    // Save server location information
    speedTestProgress.location = `${result.server.name} (${result.server.location} - ${result.server.country})`;

    // Log the speed test result
    console.log(
      `Latency: ${speedTestProgress.latency} ms, Download: ${speedTestProgress.downloadSpeed} Mbps, Upload: ${speedTestProgress.uploadSpeed} Mbps, Progress: ${speedTestProgress.progress}%`,
    );

    // Store the full result for detailed analysis
    this.fullResults.push(result);

    return speedTestProgress;
  }

  /**
   * Connects to a specific ExpressVPN location
   * @param location - The VPN location to connect to (e.g., "USA - New York")
   * @throws Error if connection fails
   */
  async connectToVpn(location: string): Promise<void> {
    try {
      const { stdout, stderr } = await this.execAsync(`expressvpn connect "${location}"`);
      console.log(`Connected to VPN location: ${location}`);
      if (stderr) {
        console.warn(stderr);
      }
    } catch (error) {
      throw new Error(`Failed to connect to VPN: ${error}`);
    }
  }

  /**
   * Disconnects from the currently connected ExpressVPN server
   */
  async disconnectFromVpn(): Promise<void> {
    try {
      const { stdout, stderr } = await this.execAsync('expressvpn disconnect');
      console.log(`Disconnected from VPN`);
      if (stderr) {
        console.warn(stderr);
      }
    } catch (error) {
      console.error('Error disconnecting from VPN:', error);
    }
  }

  /**
   * Parses location information from the input JSON file
   * @param locationsInput - JSON data containing location information
   * @returns Array of location strings formatted as "Country - City"
   */
  parseLocations(locationsInput: LocationJSON): string[] {
    if (!locationsInput || !locationsInput.locations) {
      return [];
    }

    return locationsInput.locations.map((location) => {
      let name = location.country;

      if (location.city && location.city.trim() !== '') {
        name += ' - ' + location.city;
      }

      return name;
    });
  }
}
