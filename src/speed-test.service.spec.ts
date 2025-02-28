import { Test, TestingModule } from '@nestjs/testing';
import { SpeedTestService } from './speed-test.service';
import * as speedTest from 'speedtest-net';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import * as os from 'os';
import { LocationJSON, SpeedTestProgress } from './result.model';

// Create mock for child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Create mock for fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Create mock for speedtest-net
jest.mock('speedtest-net', () => jest.fn());

// Create mock for os module
jest.mock('os', () => ({
  hostname: jest.fn().mockReturnValue('test-hostname'),
  platform: jest.fn().mockReturnValue('test-platform'),
}));

describe('SpeedTestService', () => {
  let service: SpeedTestService;
  let mockExecCallback: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock for exec
    mockExecCallback = jest.fn();
    ((childProcess.exec as unknown) as jest.Mock).mockImplementation((cmd, callback) => {
      if (callback) {
        mockExecCallback(null, { stdout: 'mock stdout', stderr: '' });
      }
      return { stdout: 'mock stdout', stderr: '' };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [SpeedTestService],
    }).compile();

    service = module.get<SpeedTestService>(SpeedTestService);
    // Override the execAsync with a mock that returns a promise
    service.execAsync = jest.fn().mockResolvedValue({ stdout: 'mock stdout', stderr: '' });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVpnLocations', () => {
    it('should call execAsync with correct command and write to file', async () => {
      await service.getVpnLocations();

      expect(service.execAsync).toHaveBeenCalledWith('expressvpn list all');
      expect(fs.writeFileSync).toHaveBeenCalledWith('vpn-locations.txt', 'mock stdout');
    });

    it('should handle errors properly', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      ((service.execAsync as unknown) as jest.Mock).mockRejectedValue(new Error('Test error'));

      await service.getVpnLocations();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting VPN locations:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('runSpeedTest', () => {
    beforeEach(() => {
      // Mock readFileSync to return a valid JSON
      ((fs.readFileSync as unknown) as jest.Mock).mockReturnValue(JSON.stringify({
        locations: [
          { country: 'USA', city: 'New York' },
          { country: 'Germany', city: 'Berlin' }
        ]
      }));

      // Mock the getSpeedTestResult method
      jest.spyOn(service, 'getSpeedTestResult').mockResolvedValue({
        location: 'Test Server (Test Location - Test Country)',
        downloadSpeed: 100,
        uploadSpeed: 50,
        progress: 100,
        latency: 20,
        error: '',
      });

      // Mock the connect and disconnect methods
      jest.spyOn(service, 'connectToVpn').mockResolvedValue();
      jest.spyOn(service, 'disconnectFromVpn').mockResolvedValue();
    });

    it('should run base speed test without VPN', async () => {
      await service.runSpeedTest();

      expect(service.results.WithoutVPN).toEqual({
        LocationName: 'Test Server (Test Location - Test Country)',
        TimeToConnect: 20,
        VPNSpeedDownload: 100,
        VPNSpeedUpload: 50,
      });
    });

    it('should test all locations from input file', async () => {
      await service.runSpeedTest();

      expect(service.results.WithVPN.length).toEqual(2);
      expect(service.connectToVpn).toHaveBeenCalledTimes(2);
      expect(service.disconnectFromVpn).toHaveBeenCalledTimes(2);
    });

    it('should handle location parsing errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      ((fs.readFileSync as unknown) as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      await service.runSpeedTest();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error reading input locations file:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should handle base speed test errors', async () => {
      jest.spyOn(service, 'getSpeedTestResult').mockRejectedValueOnce(new Error('Speed test error'));

      await service.runSpeedTest();

      expect(service.results.error).toEqual('Error running base speed test');
    });

    it('should handle VPN connection errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(service, 'connectToVpn').mockRejectedValueOnce(new Error('Connection error'));

      await service.runSpeedTest();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error connecting to VPN:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should handle VPN speed test errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(service, 'getSpeedTestResult')
        .mockResolvedValueOnce({
          location: 'Test Server (Test Location - Test Country)',
          downloadSpeed: 100,
          uploadSpeed: 50,
          progress: 100,
          latency: 20,
          error: '',
        })
        .mockRejectedValue(new Error('Speed test error'));

      await service.runSpeedTest();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error running speed test:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should write results to files', async () => {
      await service.runSpeedTest();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'data/output.json',
        expect.any(String)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'data/output-full.json',
        expect.any(String)
      );
    });
  });

  describe('getSpeedTestResult', () => {
    beforeEach(() => {
      // Mock the speedTest function
      ((speedTest as unknown) as jest.Mock).mockImplementation((options) => {
        // Call progress callbacks if they exist
        if (options.progress) {
          options.progress({ type: 'ping', ping: { latency: 20 } });
          options.progress({ 
            type: 'download', 
            download: { 
              bandwidth: 12500000, // 100 Mbps
              progress: 1 
            } 
          });
          options.progress({ 
            type: 'upload', 
            upload: { 
              bandwidth: 6250000, // 50 Mbps
              progress: 1 
            } 
          });
        }

        return Promise.resolve({
          server: {
            name: 'Test Server',
            location: 'Test Location',
            country: 'Test Country',
          }
        });
      });
    });

    it('should return speed test progress with correct values', async () => {
      const result = await service.getSpeedTestResult();

      expect(result).toEqual({
        location: 'Test Server (Test Location - Test Country)',
        downloadSpeed: 100,
        uploadSpeed: 50,
        progress: 100,
        latency: 20,
        error: '',
      });
    });

    it('should add result to fullResults array', async () => {
      await service.getSpeedTestResult();

      expect(service.fullResults.length).toEqual(1);
      expect(service.fullResults[0]).toEqual(expect.objectContaining({
        server: {
          name: 'Test Server',
          location: 'Test Location',
          country: 'Test Country',
        }
      }));
    });
  });

  describe('connectToVpn', () => {
    it('should execute the correct command to connect to VPN', async () => {
      await service.connectToVpn('USA - New York');

      expect(service.execAsync).toHaveBeenCalledWith('expressvpn connect "USA - New York"');
    });

    it('should throw an error if connection fails', async () => {
      ((service.execAsync as unknown) as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(service.connectToVpn('USA - New York')).rejects.toThrow('Failed to connect to VPN: Error: Connection failed');
    });
  });

  describe('disconnectFromVpn', () => {
    it('should execute the correct command to disconnect from VPN', async () => {
      await service.disconnectFromVpn();

      expect(service.execAsync).toHaveBeenCalledWith('expressvpn disconnect');
    });

    it('should handle errors properly', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      ((service.execAsync as unknown) as jest.Mock).mockRejectedValue(new Error('Disconnect failed'));

      await service.disconnectFromVpn();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error disconnecting from VPN:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('parseLocations', () => {
    it('should parse locations correctly with city', () => {
      const input: LocationJSON = {
        locations: [
          { country: 'USA', city: 'New York' },
          { country: 'Germany', city: 'Berlin' }
        ]
      };

      const result = service.parseLocations(input);

      expect(result).toEqual(['USA - New York', 'Germany - Berlin']);
    });

    it('should parse locations correctly without city', () => {
      const input: LocationJSON = {
        locations: [
          { country: 'USA', city: '' },
          { country: 'Germany', city: '  ' }
        ]
      };

      const result = service.parseLocations(input);

      expect(result).toEqual(['USA', 'Germany']);
    });

    it('should handle undefined or null input', () => {
      expect(service.parseLocations({ locations: [] })).toEqual([]);
      const originalMethod = service.parseLocations;
      try {
        // @ts-ignore - Testing edge case
        service.parseLocations = (input: any) => originalMethod.call(service, input);
        // @ts-ignore - Intentionally testing with invalid input
        expect(service.parseLocations(null)).toEqual([]);
      } finally {
        service.parseLocations = originalMethod;
      }
    });
  });
});
