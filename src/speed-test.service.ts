import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as speedTest from 'speedtest-net';
import { readFileSync, writeFileSync } from 'fs';
import { LocationJSON, SpeedTestProgress, SpeedTestResult } from './result.model';
import * as os from 'os';

@Injectable()
export class SpeedTestService {
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
  fullResults: any[] = [];

  execAsync = promisify(exec);

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

  async runSpeedTest(): Promise<void> {
    let locations: string[];
    try {
      const locationsInput = JSON.parse(readFileSync('data/input.json', 'utf8'));

      locations = this.parseLocations(locationsInput);
    } catch (error) {
      console.error('Error reading input locations file:', error);
      return;
    }

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

    for (const location of locations) {
      const speedTestsProgress: SpeedTestProgress[] = [];

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

      for (let i = 0; i < 5; i++) {
        console.log(`Running speed test ${i + 1}...`);
        try {
          const vpnResult = await this.getSpeedTestResult();
          speedTestsProgress.push(vpnResult);

          if (i === 4) {
            this.results.WithVPN.push({
              LocationName: location,
              TimeToConnect: speedTestsProgress.reduce((avg, progress) => avg + progress.latency, 0) / speedTestsProgress.length,
              VPNSpeedDownload: speedTestsProgress.reduce((avg, progress) => avg + progress.downloadSpeed, 0) / speedTestsProgress.length,
              VPNSpeedUpload: speedTestsProgress.reduce((avg, progress) => avg + progress.uploadSpeed, 0) / speedTestsProgress.length,
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

      await this.disconnectFromVpn();
    }

    writeFileSync('data/output.json', JSON.stringify(this.results, null, 2));
    writeFileSync('data/output-full.json', JSON.stringify(this.fullResults, null, 2));

    console.log('Finished running speed tests! Please verify output files from data folder.');
  }

  async getSpeedTestResult(): Promise<SpeedTestProgress> {
    const speedTestProgress: SpeedTestProgress = {
      location: '',
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 0,
      latency: 0,
      error: '',
    };

    const result = await speedTest({
      acceptLicense: true,
      acceptGdpr: true,
      progress: (progress) => {
        if (progress) {
          if (progress.type === 'download') {
            speedTestProgress.downloadSpeed = Number((progress.download.bandwidth / 125000).toFixed(2));
            speedTestProgress.progress = Math.round((progress.download.progress || 0) * 100 * 0.5);
          }

          if (progress.type === 'upload') {
            speedTestProgress.uploadSpeed = Number((progress.upload.bandwidth / 125000).toFixed(2));
            speedTestProgress.progress = Math.round((progress.upload.progress || 0) * 100 * 0.5) + 50;
          }

          if (progress.type === 'ping') {
            speedTestProgress.latency = progress.ping.latency;
          }
        }
      },
    });

    speedTestProgress.location = `${result.server.name} (${result.server.location} - ${result.server.country})`;

    console.log(
      `Latency: ${speedTestProgress.latency} ms, Download: ${speedTestProgress.downloadSpeed} Mbps, Upload: ${speedTestProgress.uploadSpeed} Mbps, Progress: ${speedTestProgress.progress}%`,
    );

    this.fullResults.push(result);

    return speedTestProgress;
  }

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

  parseLocations(locationsInput: LocationJSON): string[] {
    return locationsInput?.locations?.map((location) => {
      let name = location.country;

      if (location.city && location.city.trim() !== '') {
        name += ' - ' + location.city;
      }

      return name;
    });
  }
}
