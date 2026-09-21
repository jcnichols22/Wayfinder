export interface Location {
  id: number;
  name: string;
  address: string;
  active: boolean;
  favorite: boolean;
  isOffice: boolean;
}

export interface Ticket {
  id: number;
  visitId: number;
  ticketNumber: string;
  createdAt: string;
}

export interface Mileage {
  id: number;
  fromLocationName: string;
  toLocationName: string;
  distanceMiles: number;
  estimated: boolean;
}

export interface Visit {
  id: number;
  locationId: number;
  location: Location;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  tickets: Ticket[];
  mileage?: Mileage | null;
}

export interface PlanStop {
  id: number;
  locationId: number | null;
  location: Location | null;
  label: string;
  address: string;
  ticketNumber: string | null;
  priority: "high" | "medium" | "low" | null;
  order: number;
  done: boolean;
  distanceFromPrevious: { miles: number; estimated: boolean } | null;
}

export interface TimeSplit {
  workingMinutes: number;
  adminMinutes: number;
  driveMinutes: number;
  workingFormatted: string;
  adminFormatted: string;
  driveFormatted: string;
  totalFormatted: string;
}

export interface DashboardData {
  visitsThisMonth: number;
  hoursOnsiteThisMonth: string;
  minutesOnsiteThisMonth: number;
  mileageThisMonth: number;
  topLocations: { name: string; count: number }[];
  recentVisits: Visit[];
  activeVisit: Visit | null;
  timeSplit: TimeSplit;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse failures
    }
    throw new ApiError(message, res.status);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ username: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request<{ username: string }>("/auth/me"),

  getLocations: (includeInactive = false) =>
    request<Location[]>(`/locations${includeInactive ? "?includeInactive=true" : ""}`),
  createLocation: (data: { name: string; address: string; favorite?: boolean; isOffice?: boolean }) =>
    request<Location>("/locations", { method: "POST", body: JSON.stringify(data) }),
  updateLocation: (id: number, data: Partial<Location>) =>
    request<Location>(`/locations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateLocation: (id: number) => request<Location>(`/locations/${id}`, { method: "DELETE" }),
  deleteLocationPermanent: (id: number) =>
    request<{ ok: true }>(`/locations/${id}/permanent`, { method: "DELETE" }),

  getActiveVisit: () => request<Visit | null>("/visits/active"),
  getVisits: (params?: { from?: string; to?: string; locationId?: number }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.locationId) qs.set("locationId", String(params.locationId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Visit[]>(`/visits${suffix}`);
  },
  startVisit: (data: { locationId: number; tickets?: string[]; clientId?: string; startTime?: string }) =>
    request<Visit>("/visits/start", { method: "POST", body: JSON.stringify(data) }),
  endVisit: (visitId: number, endTime?: string) =>
    request<Visit>(`/visits/${visitId}/end`, { method: "POST", body: JSON.stringify({ endTime }) }),
  deleteVisit: (visitId: number) => request<{ ok: true }>(`/visits/${visitId}`, { method: "DELETE" }),
  updateVisit: (visitId: number, data: { startTime?: string | null; endTime?: string | null; locationId?: number; notes?: string | null }) =>
    request<Visit>(`/visits/${visitId}`, { method: "PUT", body: JSON.stringify(data) }),
  updateVisitNotes: (visitId: number, notes: string) =>
    request<Visit>(`/visits/${visitId}/notes`, { method: "PUT", body: JSON.stringify({ notes }) }),
  addTicket: (visitId: number, ticketNumber: string) =>
    request<Ticket>(`/visits/${visitId}/tickets`, { method: "POST", body: JSON.stringify({ ticketNumber }) }),
  removeTicket: (visitId: number, ticketId: number) =>
    request(`/visits/${visitId}/tickets/${ticketId}`, { method: "DELETE" }),

  getDashboard: () => request<DashboardData>("/reports/dashboard"),
  getDailyReport: (date?: string) => request(`/reports/daily${date ? `?date=${date}` : ""}`),
  getMonthlyReport: (year: number, month: number) =>
    request(`/reports/monthly?year=${year}&month=${month}`),
  exportCsvUrl: (range: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ range, ...params });
    return `/api/reports/export/csv?${qs.toString()}`;
  },
  downloadCsv: async (range: string, params: Record<string, string> = {}) => {
    const url = api.exportCsvUrl(range, params);
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      let message = `Export failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        // ignore parse failures
      }
      throw new ApiError(message, res.status);
    }
    const disposition = res.headers.get("content-disposition") ?? "";
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
    const filename = filenameMatch?.[1] ?? `wayfinder-${range}-export.csv`;

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  syncActions: (actions: unknown[]) =>
    request<{ results: any[] }>("/sync", { method: "POST", body: JSON.stringify({ actions }) }),

  getPlan: () => request<PlanStop[]>("/plan"),
  addPlanStop: (data: {
    locationId?: number;
    label?: string;
    address?: string;
    ticketNumber?: string;
    priority?: string;
  }) => request<PlanStop>("/plan", { method: "POST", body: JSON.stringify(data) }),
  updatePlanStop: (id: number, data: Partial<Pick<PlanStop, "done" | "priority" | "ticketNumber" | "label" | "address">>) =>
    request<PlanStop>(`/plan/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  movePlanStop: (id: number, direction: "up" | "down") =>
    request<PlanStop[]>(`/plan/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) }),
  reorderPlanStops: (stopIds: number[]) =>
    request<PlanStop[]>("/plan/reorder", { method: "POST", body: JSON.stringify({ stopIds }) }),
  startVisitFromPlan: (id: number) => request<Visit>(`/plan/${id}/start-visit`, { method: "POST" }),
  deletePlanStop: (id: number) => request<{ ok: true }>(`/plan/${id}`, { method: "DELETE" }),
  clearPlan: (onlyDone = false) =>
    request<{ ok: true }>(`/plan${onlyDone ? "?onlyDone=true" : ""}`, { method: "DELETE" }),
};

export { ApiError };
