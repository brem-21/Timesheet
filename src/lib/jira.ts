import { Ticket, User, calculateHours } from "./utils";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getAuthHeader(): string {
  const email = process.env.JIRA_EMAIL!;
  const token = process.env.JIRA_API_TOKEN!;
  const encoded = Buffer.from(`${email}:${token}`).toString("base64");
  return `Basic ${encoded}`;
}

function getBaseUrl(): string {
  return process.env.JIRA_BASE_URL!;
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${getBaseUrl()}/rest/api/3/myself`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira /myself error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    accountId: data.accountId,
    displayName: data.displayName,
    emailAddress: data.emailAddress,
    avatarUrl: data.avatarUrls?.["48x48"] ?? "",
  };
}

// ─── Search Users ─────────────────────────────────────────────────────────────

export async function searchUser(query: string): Promise<User[]> {
  const url = `${getBaseUrl()}/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=20`;

  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira user search error ${res.status}: ${text}`);
  }

  const data: Array<{
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrls?: Record<string, string>;
    accountType: string;
  }> = await res.json();

  // Filter out bots / service accounts
  return data
    .filter((u) => u.accountType === "atlassian")
    .map((u) => ({
      accountId: u.accountId,
      displayName: u.displayName,
      emailAddress: u.emailAddress ?? "",
      avatarUrl: u.avatarUrls?.["48x48"] ?? "",
    }));
}

// ─── Fetch Tickets by Date Range ─────────────────────────────────────────────

export async function fetchTicketsByRange(
  accountId: string,
  startDate: string,
  endDate: string
): Promise<Ticket[]> {
  const jql = `assignee = "${accountId}" AND updated >= "${startDate}" AND updated <= "${endDate}" ORDER BY updated DESC`;

  const body = {
    jql,
    maxResults: 200,
    fields: ["summary", "status", "priority", "assignee", "created", "updated"],
  };

  const res = await fetch(`${getBaseUrl()}/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira search error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const allIssues = data.issues ?? [];

  return allIssues.map(
    (issue: {
      id: string;
      key: string;
      fields: {
        summary: string;
        status: { name: string };
        priority: { name: string };
        assignee: { displayName: string; accountId: string } | null;
        created: string;
        updated: string;
      };
    }): Ticket => {
      const created = issue.fields.created;
      const updated = issue.fields.updated;
      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name ?? "Unknown",
        priority: issue.fields.priority?.name ?? "Medium",
        assignee: issue.fields.assignee?.displayName ?? null,
        assigneeAccountId: issue.fields.assignee?.accountId ?? null,
        created,
        updated,
        hours: calculateHours(created, updated),
        url: `${getBaseUrl()}/browse/${issue.key}`,
      };
    }
  );
}

// ─── Fetch Tickets ────────────────────────────────────────────────────────────

export async function fetchTickets(
  accountId: string,
  month: string,
  year: string
): Promise<Ticket[]> {
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  // First and last day of the requested month
  const startDate = `${year}-${String(monthNum).padStart(2, "0")}-01`;
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const jql = `assignee = "${accountId}" AND updated >= "${startDate}" AND updated <= "${endDate}" ORDER BY updated DESC`;

  const body = {
    jql,
    maxResults: 200,
    fields: ["summary", "status", "priority", "assignee", "created", "updated"],
  };

  const res = await fetch(`${getBaseUrl()}/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira search error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // The new /search/jql endpoint uses nextPageToken for pagination
  let allIssues = data.issues ?? [];
  let nextPageToken = data.nextPageToken;

  while (nextPageToken) {
    const nextRes = await fetch(`${getBaseUrl()}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...body, nextPageToken }),
      cache: "no-store",
    });
    const nextData = await nextRes.json();
    allIssues = allIssues.concat(nextData.issues ?? []);
    nextPageToken = nextData.nextPageToken;
  }

  return allIssues.map(
    (issue: {
      id: string;
      key: string;
      fields: {
        summary: string;
        status: { name: string };
        priority: { name: string };
        assignee: { displayName: string; accountId: string } | null;
        created: string;
        updated: string;
      };
    }): Ticket => {
      const created = issue.fields.created;
      const updated = issue.fields.updated;
      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name ?? "Unknown",
        priority: issue.fields.priority?.name ?? "Medium",
        assignee: issue.fields.assignee?.displayName ?? null,
        assigneeAccountId: issue.fields.assignee?.accountId ?? null,
        created,
        updated,
        hours: calculateHours(created, updated),
        url: `${getBaseUrl()}/browse/${issue.key}`,
      };
    }
  );
}
