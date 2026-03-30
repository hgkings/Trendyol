// ----------------------------------------------------------------
// API Client — UI katmanindan kullanilan fetch wrapper.
// Katman 1 (app/, components/) SADECE bunu kullanir.
// ----------------------------------------------------------------

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  traceId?: string
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = ''
  }

  async get<T = unknown>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return res.json() as Promise<ApiResponse<T>>
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json() as Promise<ApiResponse<T>>
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json() as Promise<ApiResponse<T>>
  }

  async del<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json() as Promise<ApiResponse<T>>
  }
}

export const apiClient = new ApiClient()
