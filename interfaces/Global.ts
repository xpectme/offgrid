declare global {
  interface FetchEvent extends Event {
    request: Request;
    respondWith(response: Promise<Response> | Response): void;
  }

  interface GlobalEventHandlersEventMap {
    fetch: FetchEvent;
  }

  interface BatteryManagerEventMap {
    chargingchange: Event;
    chargingtimechange: Event;
    dischargingtimechange: Event;
    levelchange: Event;
  }

  interface BatteryManager {
    level: number;
    charging: boolean;

    addEventListener<K extends keyof BatteryManagerEventMap>(
      type: K,
      // deno-lint-ignore no-explicit-any
      listener: (this: this, ev: BatteryManagerEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions,
    ): void;

    removeEventListener<K extends keyof BatteryManagerEventMap>(
      type: K,
      // deno-lint-ignore no-explicit-any
      listener: (this: this, ev: BatteryManagerEventMap[K]) => any,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  interface NetworkInformationEventMap {
    change: Event;
  }

  interface NetworkInformation extends EventTarget {
    type: string;
    downlink: number;
    downlinkMax: number;
    effectiveType: string;
    rtt: number;
    saveData: boolean;

    addEventListener<K extends keyof NetworkInformationEventMap>(
      type: K,
      // deno-lint-ignore no-explicit-any
      listener: (this: this, ev: NetworkInformationEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions,
    ): void;

    removeEventListener<K extends keyof NetworkInformationEventMap>(
      type: K,
      // deno-lint-ignore no-explicit-any
      listener: (this: this, ev: NetworkInformationEventMap[K]) => any,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  interface Navigator {
    getBattery: () => Promise<BatteryManager>;

    connection: NetworkInformation;
  }
}
