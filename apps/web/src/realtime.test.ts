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
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  sent: string[] = [];

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
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
    const onParticipantUpdated = vi.fn();

    openSignaling("ROOM/ID", "A B", {
      onHello: vi.fn(),
      onPeerJoined: vi.fn(),
      onPeerLeft: vi.fn(),
      onParticipantUpdated,
      onSignal: vi.fn(),
      onError: vi.fn(),
      onClose,
    });

    expect(FakeWebSocket.instances[0]?.url).toBe("wss://puzzle.example/api/rooms/ROOM%2FID/socket?name=A%20B");
    FakeWebSocket.instances[0]?.dispatch("message", {
      data: JSON.stringify({
        type: "participant-updated",
        participant: { id: "a", name: "Ada", isHost: true },
        participants: [{ id: "a", name: "Ada", isHost: true }],
      }),
    });
    expect(onParticipantUpdated).toHaveBeenCalledWith({ id: "a", name: "Ada", isHost: true }, [{ id: "a", name: "Ada", isHost: true }]);
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

  it("waits for data channel backpressure to drain before flushing queued messages", async () => {
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    const mesh = new PeerMesh("a", iceConfig, vi.fn<(to: string, payload: PeerSignal) => void>(), {
      onMessage: vi.fn<(from: string, message: ChannelMessage) => void>(),
      onConnectionChange: vi.fn(),
    });

    mesh.connectToParticipants(participants);
    await flushPromises();
    const channel = FakePeerConnection.instances[0]!.channels[0]!;
    channel.readyState = "open";
    channel.bufferedAmount = 1_000_001;
    channel.dispatch("open");

    mesh.send("b", { type: "piece-front", pieceId: 1, z: 2, by: "a" });
    expect(channel.sent).toHaveLength(0);

    channel.bufferedAmount = 0;
    channel.dispatch("bufferedamountlow");
    expect(channel.sent).toHaveLength(1);
    expect(JSON.parse(channel.sent[0]!) as ChannelMessage).toMatchObject({ type: "piece-front", pieceId: 1 });
  });
});
