export class Client {
  async submitTransaction(txHash: string, _rpc: SorobanRpc): Promise<{ hash: string; status: string }> {
    return { hash: txHash, status: "pending" };
  }
}

export class SorobanRpc {
  async getTransaction(_hash: string): Promise<{ status: string }> {
    return { status: "not_found" };
  }
}
