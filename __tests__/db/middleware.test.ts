import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { updateSession } from "../../lib/db/middleware";

function makeRequest(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("updateSession — session refresh runs everywhere, login is only required on protected routes", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("redirects to /login when unauthenticated on a protected route (/admin)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest("/admin"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects to /login when unauthenticated on a protected sub-route (/admin/agents)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest("/admin/agents"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects to /login when unauthenticated on /onboarding", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest("/onboarding"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("does NOT redirect unauthenticated visitors on public routes (/demo)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest("/demo"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect unauthenticated visitors on the homepage", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not treat a route that merely starts with the prefix text as protected", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(makeRequest("/adminish"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows an authenticated user through on a protected route without redirecting", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await updateSession(makeRequest("/admin/agents"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("still calls getUser() (the session-refreshing call) on a public route", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await updateSession(makeRequest("/demo"));
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
