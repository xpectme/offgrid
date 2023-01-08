// create a DeviceInfo interface
export interface DeviceInfoPosition {
  x: number;
  y: number;
  z: number;
}
export interface DeviceInfoRotation {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface DeviceInfoBattery {
  battery: number;
  charging: boolean;
}

export interface DeviceInfoNetwork {
  type: string;
  downlink: number;
  downlinkMax: number;
  effectiveType: string;
  rtt: number;
  saveData: boolean;
}

export interface DeviceInfo {
  gps: GeolocationCoordinates | null;
  motion: {
    acceleration: DeviceInfoPosition | null;
    accelerationIncludingGravity: DeviceInfoPosition | null;
    rotationRate: DeviceInfoRotation | null;
    interval: number;
    speed: number | null;
    speedGravity: number | null;
  };
  orientation: DeviceInfoRotation | null;
  onlineState: boolean;
  battery: DeviceInfoBattery | null;
  network: DeviceInfoNetwork | null;
}
