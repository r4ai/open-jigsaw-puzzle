import { afterEach, describe, expect, it, vi } from "vitest";
import { openSignaling, PeerMesh } from "./realtime";
import type { ChannelMessage, IceConfig, Participant, PeerSignal } from "@open-puzzle/shared/protocol";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeDataChannel {
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  readyState: RTCDataChannelState = "connecting";
  sent: string[] = [];

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = "closed";
    for (const listener of this.listeners.get("close") ?? []) listener({});
  }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  readonly channels: FakeDataChannel[] = [];
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;

  constructor() {
    FakePeerConnection.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  createDataChannel(): FakeDataChannel {
    const channel = new FakeDataChannel();
    this.channels.push(channel);
    return channel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "offer" };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: "answer" };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description;
  }

  async addIceCandidate(): Promise<void> {}

  close(): void {
    this.connectionState = "closed";
  }
}

const iceConfig: IceConfig = { iceServers: [] };
const participants: Participant[] = [{ id: "b", name: "Peer", isHost: false }];

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWebSocket.instances = [];
  FakePeerConnection.instances = [];
});

describe("openSignaling", () => {
  it("encodes room ids in the websocket URL and reports unexpected closes", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", host: "puzzle.example" } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const onClose = vi.fn();

    openSignaling("ROOM/ID", "A B", {
      onHello: vi.fn(),
      onPeerJoined: vi.fn(),
      onPeerLeft: vi.fn(),
      onSignal: vi.fn(),
      onError: vi.fn(),
      onClose,
    });

    expect(FakeWebSocket.instances[0]?.url).toBe("wss://puzzle.example/api/rooms/ROOM%2FID/socket?name=A%20B");
    FakeWebSocket.instances[0]?.dispatch("close", { wasClean: false, reason: "upgrade failed" });
    expect(onClose).toHaveBeenCalledWith("upgrade failed");
  });
});

describe("PeerMesh", () => {
  it("drops failed peer connections and retries the initiator connection", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    const sendSignal = vi.fn<(to: string, payload: PeerSignal) => void>();
    const mesh = new PeerMesh("a", iceConfig, sendSignal, {
      onMessage: vi.fn<(from: string, message: ChannelMessage) => void>(),
      onConnectionChange: vi.fn(),
    });

    mesh.connectToParticipants(participants);
    await flushPromises();
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal.mock.calls[0]?.[1].type).toBe("offer");

    FakePeerConnection.instances[0]!.connectionState = "failed";
    FakePeerConnection.instances[0]!.dispatch("connectionstatechange");
    vi.advanceTimersByTime(750);
    await flushPromises();

    expect(FakePeerConnection.instances).toHaveLength(2);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect(sendSignal.mock.calls[1]?.[1].type).toBe("offer");
  });
});
