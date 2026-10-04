import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeCodeForToken, fetchGithubUser, getGithubAuthorizeUrl } from "./github";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("getGithubAuthorizeUrl", () => {
  it("builds the GitHub authorize URL with client_id, redirect_uri, scope, and state", () => {
    const url = new URL(
      getGithubAuthorizeUrl("http://localhost:3000/auth/github/callback", "abc123")
    );
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/github/callback"
    );
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("scope")).toBe("read:user");
  });

  it("throws if GITHUB_CLIENT_ID is not set", () => {
    delete process.env.GITHUB_CLIENT_ID;
    expect(() => getGithubAuthorizeUrl("http://x", "s")).toThrow();
  });
});

describe("exchangeCodeForToken", () => {
  it("returns the access_token from a successful GitHub response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "gho_mocked" }),
      })
    );
    const token = await exchangeCodeForToken("some-code");
    expect(token).toBe("gho_mocked");
  });

  it("throws when GitHub responds with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(exchangeCodeForToken("bad-code")).rejects.toThrow();
  });

  it("throws when the response has no access_token (e.g. bad client secret)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "bad_verification_code" }),
      })
    );
    await expect(exchangeCodeForToken("some-code")).rejects.toThrow();
  });
});

describe("fetchGithubUser", () => {
  it("returns the parsed GitHub user profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 42, login: "octocat", avatar_url: "https://example.com/a.png" }),
      })
    );
    const user = await fetchGithubUser("gho_mocked");
    expect(user).toEqual({ id: 42, login: "octocat", avatar_url: "https://example.com/a.png" });
  });

  it("throws when GitHub responds with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchGithubUser("bad-token")).rejects.toThrow();
  });
});
