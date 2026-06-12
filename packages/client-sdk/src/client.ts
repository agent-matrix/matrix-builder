export interface MatrixBuilderClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export class MatrixBuilderClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: MatrixBuilderClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`);
    if (!response.ok) throw new Error(`Matrix Builder request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }

  async post<T, B = unknown>(path: string, body?: B): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Matrix Builder request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
}
