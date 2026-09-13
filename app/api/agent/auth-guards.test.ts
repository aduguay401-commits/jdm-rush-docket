import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: vi.fn(),
  authFrom: vi.fn(),
  authSelect: vi.fn(),
  authEq: vi.fn(),
  service: vi.fn(),
  sendEmail: vi.fn(),
  sendSMS: vi.fn(),
  exchange: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server-auth", () => ({
  createServerAuthClient: async () => ({
    auth: { getUser: boundary.getUser },
    from: boundary.authFrom,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: boundary.service }));
vi.mock("@/lib/email", () => ({ sendEmail: boundary.sendEmail }));
vi.mock("@/lib/sms", () => ({ sendSMS: boundary.sendSMS }));
vi.mock("@/lib/exchangeRate", () => ({ fetchJPYtoCAD: boundary.exchange }));

// Deliberately do not mock lib/admin/auth: role decisions use the real helper.
import { POST as proceed } from "./proceed/route";
import { POST as sendQuestions } from "./send-questions/route";
import { POST as research } from "./research/[id]/route";

const routes = [
  { name: "proceed", post: proceed },
  { name: "send-questions", post: sendQuestions },
  { name: "research", post: (request: Request) => research(request, { params: Promise.resolve({ id: "fixture-docket" }) }) },
];

beforeEach(() => {
  vi.resetAllMocks();
  boundary.getUser.mockResolvedValue({ data: { user: null }, error: null });
  boundary.profile.mockResolvedValue({ data: null, error: null });
  boundary.authFrom.mockReturnValue({ select: boundary.authSelect });
  boundary.authSelect.mockReturnValue({ eq: boundary.authEq });
  boundary.authEq.mockReturnValue({ maybeSingle: boundary.profile });
  boundary.service.mockImplementation(() => { throw new Error("Unexpected business access"); });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access"); }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

for (const route of routes) {
  describe(route.name, () => {
    it.each([
      "anonymous", "customer", "unknown role", "missing profile", "null role", "profile error", "auth error",
    ])("denies %s before body parsing or side effects", async (scenario) => {
      if (scenario !== "anonymous" && scenario !== "auth error") {
        boundary.getUser.mockResolvedValue({ data: { user: { id: "fixture-user" } }, error: null });
      }
      if (scenario === "customer") boundary.profile.mockResolvedValue({ data: { role: "customer" }, error: null });
      if (scenario === "unknown role") boundary.profile.mockResolvedValue({ data: { role: "owner" }, error: null });
      if (scenario === "null role") boundary.profile.mockResolvedValue({ data: { role: null }, error: null });
      // Even a privileged-looking row must not override an explicit profile error.
      if (scenario === "profile error") boundary.profile.mockResolvedValue({ data: { role: "admin" }, error: { message: "profile unavailable" } });
      if (scenario === "auth error") boundary.getUser.mockResolvedValue({ data: { user: null }, error: { message: "session expired" } });
      const request = new Request("http://localhost/fixture", { method: "POST", body: "not JSON", headers: { "content-type": "application/json" } });
      const parse = vi.spyOn(request, "json");
      const text = vi.spyOn(request, "text");
      const form = vi.spyOn(request, "formData");
      const response = await route.post(request);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ success: false, error: "Unauthorized" });
      expect(parse).not.toHaveBeenCalled();
      expect(text).not.toHaveBeenCalled();
      expect(form).not.toHaveBeenCalled();
      expect(request.bodyUsed).toBe(false);
      expect(boundary.service).not.toHaveBeenCalled();
      expect(boundary.sendEmail).not.toHaveBeenCalled();
      expect(boundary.sendSMS).not.toHaveBeenCalled();
      expect(boundary.exchange).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      if (scenario === "anonymous" || scenario === "auth error") {
        expect(boundary.authFrom).not.toHaveBeenCalled();
      } else {
        expect(boundary.authFrom).toHaveBeenCalledWith("profiles");
        expect(boundary.authEq).toHaveBeenCalledWith("id", "fixture-user");
      }
    });

    it.each(["admin", "agent"])("allows %s through validation to a safe mocked docket lookup", async (role) => {
      boundary.getUser.mockResolvedValue({ data: { user: { id: "fixture-user" } }, error: null });
      boundary.profile.mockResolvedValue({ data: { role }, error: null });
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const from = vi.fn().mockReturnValue(query);
      boundary.service.mockReturnValue({ from });
      const request = new Request("http://localhost/fixture", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ docketId: "fixture-docket", questions: ["Which colour?"],
          overallNotes: "Fixture research", privateDealerOptions: [
            { optionNumber: 1, year: "2000", make: "Toyota", model: "Supra", dealerPriceJpy: 1000000 },
          ],
        }),
      });
      const response = await route.post(request);
      expect(response.status).toBe(route.name === "research" ? 400 : 404);
      expect(await response.json()).toEqual(expect.objectContaining({
        success: false, error: route.name === "research" ? "Docket not found." : "Docket not found",
      }));
      expect(request.bodyUsed).toBe(true);
      expect(from).toHaveBeenCalledWith("dockets");
      expect(query.eq).toHaveBeenCalledWith("id", "fixture-docket");
      expect(query.maybeSingle).toHaveBeenCalledOnce();
      expect(boundary.sendEmail).not.toHaveBeenCalled();
      expect(boundary.sendSMS).not.toHaveBeenCalled();
      expect(boundary.exchange).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each(["admin", "agent"])("preserves malformed-body rejection for %s", async (role) => {
      boundary.getUser.mockResolvedValue({ data: { user: { id: "fixture-user" } }, error: null });
      boundary.profile.mockResolvedValue({ data: { role }, error: null });
      const response = await route.post(new Request("http://localhost/fixture", {
        method: "POST", headers: { "content-type": "application/json" }, body: "not JSON",
      }));
      expect(response.status).toBe(400);
      expect(boundary.service).not.toHaveBeenCalled();
    });
  });
}

it.each(["admin", "agent"])("allows %s to proceed using mocked writes and email", async (role) => {
  boundary.getUser.mockResolvedValue({ data: { user: { id: "fixture-user" } }, error: null });
  boundary.profile.mockResolvedValue({ data: { role }, error: null });
  vi.stubEnv("FROM_EMAIL", "sender@example.invalid");
  vi.stubEnv("ADMIN_EMAIL", "admin@example.invalid");
  vi.stubEnv("DEV_MODE", "true");
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "fixture-docket", status: "new" }, error: null }),
    error: null,
  };
  boundary.service.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
  boundary.sendEmail.mockResolvedValue({ error: null });
  const response = await proceed(new Request("http://localhost/fixture", {
    method: "POST", body: JSON.stringify({ docketId: "fixture-docket" }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(query.update).toHaveBeenCalledWith({ status: "research_in_progress" });
  expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ new_status: "research_in_progress" }));
  expect(boundary.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.invalid" }));
  expect(fetch).not.toHaveBeenCalled();
});
