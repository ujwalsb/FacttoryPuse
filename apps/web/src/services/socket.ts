import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  connect(token: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('Socket connected successfully');
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', err => {
      console.warn('Socket connection error:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  subscribeMachine(machineId: string) {
    if (this.socket) {
      this.socket.emit('machine:subscribe', machineId);
    }
  }

  joinMachine(machineId: string) {
    this.subscribeMachine(machineId);
  }

  unsubscribeMachine(machineId: string) {
    if (this.socket) {
      this.socket.emit('machine:unsubscribe', machineId);
    }
  }

  leaveMachine(machineId: string) {
    this.unsubscribeMachine(machineId);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
