import { DeviceInfo } from "../interfaces/DeviceInfo.ts";

export interface DeviceInfoServiceOptions {
  broadcastInterval: number;
  gps: PositionOptions;
}

export class DeviceInfoService {
  #broadcast = new BroadcastChannel("device-info");

  #deviceInfo: DeviceInfo = {
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
  get deviceInfo(): DeviceInfo {
    return this.#deviceInfo;
  }

  #options: DeviceInfoServiceOptions = {
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

  constructor(options: Partial<DeviceInfoServiceOptions> = {}) {
    this.#options = { ...this.#options, ...options };
  }

  #gpsSuccess = (position: GeolocationPosition) => {
    this.#deviceInfo.gps = { ...position.coords };
  };

  #gpsError = (error: GeolocationPositionError) => {
    // handle error
    console.error(error);
  };

  #deviceOrientation = (event: DeviceOrientationEvent) => {
    // check if orientation is available
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      this.#deviceInfo.orientation = {
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
        this.#deviceInfo.motion.acceleration = { x, y, z };
      }
    }

    // check if accelerationIncludingGravity is available and test if the values are not null
    if (accelerationIncludingGravity) {
      const { x, y, z } = accelerationIncludingGravity;

      if (x !== null && y !== null && z !== null) {
        this.#deviceInfo.motion.accelerationIncludingGravity = { x, y, z };
      }
    }

    // check if rotationRate is available and test if the values are not null
    if (rotationRate) {
      const { alpha, beta, gamma } = rotationRate;

      if (alpha !== null && beta !== null && gamma !== null) {
        this.#deviceInfo.motion.rotationRate = { alpha, beta, gamma };
      }
    }

    // check if interval is available
    if (interval) {
      this.#deviceInfo.motion.interval = interval;
    }
  };

  #onlineState = () => {
    this.#deviceInfo.onlineState = navigator.onLine;
  };

  #batteryChange = () => {
    if (this.#battery) {
      this.#deviceInfo.battery = {
        battery: this.#battery.level,
        charging: this.#battery.charging,
      };
    }
  };

  #connectionChange = () => {
    this.#deviceInfo.network = { ...navigator.connection };
  };

  start() {
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
        this.#deviceInfo.battery = {
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

    // broadcast the device info
    this.#broadcastIntervalId = setInterval(() => {
      this.#broadcast.postMessage(this.#deviceInfo);
    }, this.#options.broadcastInterval);
  }

  stop() {
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

export function deviceBroadcast(options?: Partial<DeviceInfoServiceOptions>) {
  return new DeviceInfoService(options);
}
