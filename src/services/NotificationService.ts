type NotificationCallback = (data: any) => void;

class NotificationService {
  private socket: WebSocket | null = null;
  private callbacks: Set<NotificationCallback> = new Set();
  private reconnectTimeout: any = null;

  constructor() {
    this.connect();
  }

  private connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onopen = () => {
      console.log('Connected to notification server');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.forEach(callback => callback(data));
      } catch (e) {
        console.error('Error parsing notification message', e);
      }
    };

    this.socket.onclose = () => {
      console.log('Disconnected from notification server, retrying...');
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.socket?.close();
    };
  }

  public subscribe(callback: NotificationCallback) {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public notifyNewOrder(order: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'NEW_ORDER',
        order
      }));
    }
  }
}

export const notificationService = new NotificationService();
