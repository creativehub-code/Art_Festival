class SSEManager {
  constructor() {
    this.clients = new Map(); // programId (string) -> Set of Express res objects
  }

  /**
   * Register a new client SSE response stream for a program
   * @param {string|ObjectId} programId 
   * @param {object} res - Express response object
   */
  addClient(programId, res) {
    const key = programId.toString();
    if (!this.clients.has(key)) {
      this.clients.set(key, new Set());
    }
    this.clients.get(key).add(res);
  }

  /**
   * Remove a client SSE response stream for a program
   * @param {string|ObjectId} programId 
   * @param {object} res - Express response object
   */
  removeClient(programId, res) {
    const key = programId.toString();
    if (this.clients.has(key)) {
      const clientSet = this.clients.get(key);
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.clients.delete(key);
      }
    }
  }

  /**
   * Broadcast an event payload to all connected SSE clients listening to a program
   * @param {string|ObjectId} programId 
   * @param {object} data - Object to broadcast
   */
  broadcast(programId, data) {
    const key = programId.toString();
    if (!this.clients.has(key)) return;

    const payload = `data: ${JSON.stringify(data)}\n\n`;
    const clientSet = this.clients.get(key);

    for (const res of clientSet) {
      try {
        res.write(payload);
      } catch (err) {
        // Client disconnected unexpectedly, clean up
        clientSet.delete(res);
      }
    }

    if (clientSet.size === 0) {
      this.clients.delete(key);
    }
  }
}

module.exports = new SSEManager();
