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

export interface DeviceInfoData {
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

export interface DeviceInfoOptions {
  broadcastInterval: number;
  gps: PositionOptions;
}

export class DeviceInfo {
  #running = false;
  #broadcast: BroadcastChannel;

  #data: DeviceInfoData = {
    gps: null,
    motion: {
      acceleration: null,
      accelerationIncludingGravity: null,
      rotationRate: null,
      interval: 0,
      speed: null,
      speedGravity: null,
    },
    orientation: null,
    onlineState: navigator.onLine,
    battery: null,
    network: null,
  };
  get data(): DeviceInfoData {
    return this.#data;
  }

  #options: DeviceInfoOptions = {
    broadcastInterval: 100,
    gps: {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    },
  };

  #battery: BatteryManager | null = null;
  #gpsWatchId: number | null = null;
  #broadcastIntervalId: number | null = null;

  constructor(options: Partial<DeviceInfoOptions> = {}) {
    this.#options = { ...this.#options, ...options };
    this.#broadcast = new BroadcastChannel("device-info");
  }

  #gpsSuccess = (position: GeolocationPosition) => {
    this.#data.gps = { ...position.coords };
  };

  #gpsError = (error: GeolocationPositionError) => {
    // handle error
    console.error(error);
  };

  #deviceOrientation = (event: DeviceOrientationEvent) => {
    // check if orientation is available
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      this.#data.orientation = {
        // create alpha based on safari or other browsers
        // deno-lint-ignore no-explicit-any
        alpha: (event as any).webkitCompassHeading || event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      };
    }
  };

  #deviceMotion = (event: DeviceMotionEvent) => {
    const {
      acceleration,
      accelerationIncludingGravity,
      rotationRate,
      interval,
    } = event;

    // check if acceleration is available and test if the values are not null
    if (acceleration) {
      const { x, y, z } = acceleration;

      if (x !== null && y !== null && z !== null) {
        this.#data.motion.acceleration = { x, y, z };
      }
    }

    // check if accelerationIncludingGravity is available and test if the values are not null
    if (accelerationIncludingGravity) {
      const { x, y, z } = accelerationIncludingGravity;

      if (x !== null && y !== null && z !== null) {
        this.#data.motion.accelerationIncludingGravity = { x, y, z };
      }
    }

    // check if rotationRate is available and test if the values are not null
    if (rotationRate) {
      const { alpha, beta, gamma } = rotationRate;

      if (alpha !== null && beta !== null && gamma !== null) {
        this.#data.motion.rotationRate = { alpha, beta, gamma };
      }
    }

    // check if interval is available
    if (interval) {
      this.#data.motion.interval = interval;
    }
  };

  #onlineState = () => {
    this.#data.onlineState = navigator.onLine;
  };

  #batteryChange = () => {
    if (this.#battery) {
      this.#data.battery = {
        battery: this.#battery.level,
        charging: this.#battery.charging,
      };
    }
  };

  #connectionChange = () => {
    this.#data.network = { ...navigator.connection };
  };

  start() {
    if (this.#running) {
      return;
    }

    // watch the GPS position
    this.#gpsWatchId = navigator.geolocation.watchPosition(
      this.#gpsSuccess,
      this.#gpsError,
      this.#options.gps,
    );

    // listen for device orientation
    globalThis.addEventListener("deviceorientation", this.#deviceOrientation);

    // listen for device motion
    globalThis.addEventListener("devicemotion", this.#deviceMotion);

    // listen for online state
    globalThis.addEventListener("online", this.#onlineState);

    globalThis.addEventListener("offline", this.#onlineState);

    // listen for battery state
    if ("getBattery" in globalThis.navigator) {
      globalThis.navigator.getBattery().then((battery) => {
        this.#battery = battery;
        this.#data.battery = {
          battery: battery.level,
          charging: battery.charging,
        };

        battery.addEventListener("levelchange", this.#batteryChange);
        battery.addEventListener("chargingchange", this.#batteryChange);
        battery.addEventListener("dischargingtimechange", this.#batteryChange);
        battery.addEventListener("chargingtimechange", this.#batteryChange);
      });
    }

    // listen for network state
    if ("connection" in globalThis.navigator) {
      navigator.connection.addEventListener("change", this.#connectionChange);
    }

    // broadcast the device info data
    this.#broadcastIntervalId = setInterval(() => {
      this.#broadcast.postMessage(this.#data);
    }, this.#options.broadcastInterval);

    this.#running = true;
  }

  stop() {
    if (!this.#running) {
      return;
    }

    this.#running = false;

    // stop watching the GPS position
    if (this.#gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.#gpsWatchId);
      this.#gpsWatchId = null;
    }

    // stop listening for device orientation
    globalThis.removeEventListener(
      "deviceorientation",
      this.#deviceOrientation,
    );

    // stop listening for device motion
    globalThis.removeEventListener("devicemotion", this.#deviceMotion);

    // stop listening for online state
    globalThis.removeEventListener("online", this.#onlineState);

    globalThis.removeEventListener("offline", this.#onlineState);

    // stop listening for battery state
    if (this.#battery) {
      this.#battery.removeEventListener("levelchange", this.#batteryChange);
      this.#battery.removeEventListener("chargingchange", this.#batteryChange);
      this.#battery.removeEventListener(
        "dischargingtimechange",
        this.#batteryChange,
      );
      this.#battery.removeEventListener(
        "chargingtimechange",
        this.#batteryChange,
      );
      this.#battery = null;
    }

    // stop listening for network state
    if ("connection" in globalThis.navigator) {
      navigator.connection.removeEventListener(
        "change",
        this.#connectionChange,
      );
    }

    // stop broadcasting the device info
    if (this.#broadcastIntervalId !== null) {
      clearInterval(this.#broadcastIntervalId);
      this.#broadcastIntervalId = null;
    }
  }
}

export const deviceInfo = new DeviceInfo();
export default deviceInfo;
