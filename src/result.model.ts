export interface SpeedTestResult {
  MachineName: string;
  OS: string;
  WithoutVPN: VPNStats;
  WithVPN: VPNStats[];
  error: string;
}

export interface VPNStats {
  LocationName: string;
  TimeToConnect: number;
  VPNSpeedDownload: number;
  VPNSpeedUpload: number;
}

export interface SpeedTestProgress {
  location: string;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  latency: number;
  error: string;
}

export interface LocationJSON {
  locations: {
    country: string;
    city: string;
  }[];
}
