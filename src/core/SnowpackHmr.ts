/**
 * Node version of the esm-hmr client
 * @see https://github.com/pikapkg/esm-hmr/blob/master/src/client.ts
 */

import * as WebSocket from 'ws'

type DisposeCallback = () => void;
type AcceptCallback = (args: { module: any; deps: any[] }) => void;
type AcceptCallbackObject = {
  deps: string[];
  callback: AcceptCallback;
};

function debug(...args: any[]) {
  console.log("[ESM-HMR]", ...args);
}
function reload() {
  // location.reload(true);
  debug('reload')
}

let SOCKET_MESSAGE_QUEUE: any[] = [];
let socket: WebSocket
function _sendSocketMessage(msg: any) {
  socket && socket.send(JSON.stringify(msg));
}
function sendSocketMessage(msg: any) {
  if (!socket || socket.readyState !== socket.OPEN) {
    SOCKET_MESSAGE_QUEUE.push(msg);
  } else {
    _sendSocketMessage(msg);
  }
}

export function client (WebSocket: WebSocket, socketURL: string): WebSocket {
  socket = new WebSocket(socketURL, "esm-hmr");
  socket.addEventListener("open", () => {
    debug(`connected to ${socketURL}`)
    SOCKET_MESSAGE_QUEUE.forEach(_sendSocketMessage);
    SOCKET_MESSAGE_QUEUE = [];
  });

  socket.addEventListener("message", ({ data: _data }: { data: any }) => {
    if (!_data) {
      return;
    }
    const data = JSON.parse(_data);
    if (data.type === "reload") {
      debug("message: reload");
      reload();
      return;
    }
    if (data.type !== "update") {
      debug("message: unknown", data);
      return;
    }
    debug("message: update", data);
    debug(data.url, Object.keys(REGISTERED_MODULES));
    applyUpdate(data.url)
      .then((ok) => {
        if (!ok) {
          reload();
        }
      })
      .catch((err) => {
        console.error(err);
        reload();
      });
  });
  
  debug("listening for file changes...");

  return socket
}

const REGISTERED_MODULES: { [key: string]: HotModuleState } = {};

export class HotModuleState {
  id: string;
  data: any = {};
  isLocked: boolean = false;
  isDeclined: boolean = false;
  isAccepted: boolean = false;
  acceptCallbacks: AcceptCallbackObject[] = [];
  disposeCallbacks: DisposeCallback[] = [];

  constructor(id: string) {
    this.id = id;
  }

  lock(): void {
    this.isLocked = true;
  }

  dispose(callback: DisposeCallback): void {
    this.disposeCallbacks.push(callback);
  }

  invalidate(): void {
    reload();
  }

  decline(): void {
    this.isDeclined = true;
  }

  accept(_deps: string[], callback: true | AcceptCallback = true): void {
    if (this.isLocked) {
      return;
    }
    if (!this.isAccepted) {
      sendSocketMessage({ id: this.id, type: "hotAccept" });
      this.isAccepted = true;
    }
    if (!Array.isArray(_deps)) {
      callback = _deps || callback;
      _deps = [];
    }
    if (callback === true) {
      callback = () => {};
    }
    const deps = _deps.map((dep) => {
      const ext = dep.split(".").pop();
      if (!ext) {
        dep += ".js";
      } else if (ext !== "js") {
        dep += ".proxy.js";
      }
      return new URL(dep, `${window.location.origin}${this.id}`).pathname;
    });
    this.acceptCallbacks.push({
      deps,
      callback,
    });
  }
}

export function createHotContext(fullUrl: string) {
  const id = new URL(fullUrl).pathname;
  const existing = REGISTERED_MODULES[id];
  if (existing) {
    existing.lock();
    return existing;
  }
  const state = new HotModuleState(id);
  REGISTERED_MODULES[id] = state;
  return state;
}

async function applyUpdate(id: string) {
  const state = REGISTERED_MODULES[id];
  if (!state) {
    return false;
  }
  if (state.isDeclined) {
    return false;
  }

  const acceptCallbacks = state.acceptCallbacks;
  const disposeCallbacks = state.disposeCallbacks;
  state.disposeCallbacks = [];
  state.data = {};

  disposeCallbacks.map((callback) => callback());
  const updateID = Date.now();
  for (const { deps, callback: acceptCallback } of acceptCallbacks) {
    const [module, ...depModules] = [
      id + `?mtime=${updateID}`,
      ...deps.map((d) => d + `?mtime=${updateID}`),
    ];
    acceptCallback({ module, deps: depModules });
  }

  return true;
}