export function installCourseAuth(): void {
  const originalFetch = window.fetch.bind(window);
  let signIn: Promise<boolean> | undefined;

  async function requestPassword(): Promise<boolean> {
    const password = window.prompt("Enter the course app password");
    if (!password) return false;
    const response = await originalFetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) window.alert("That password did not work.");
    return response.ok;
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (response.status !== 401 || url.includes("/api/session")) return response;

    signIn ||= requestPassword().finally(() => { signIn = undefined; });
    if (!await signIn) return response;
    return originalFetch(input, init);
  };
}
