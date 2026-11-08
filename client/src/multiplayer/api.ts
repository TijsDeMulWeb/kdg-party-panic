/**
 * Thin fetch wrapper for the Laravel API. Same-origin requests carry the
 * session cookie; Laravel's XSRF-TOKEN cookie is echoed back as a header.
 */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : null;
}

export async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (method !== 'GET') {
        // The first GET of a session sets the cookie; make sure we have one.
        if (!xsrfToken()) {
            await fetch('/api/clock', { credentials: 'same-origin' });
        }
        const token = xsrfToken();
        if (token) {
            headers['X-XSRF-TOKEN'] = token;
        }
    }

    const response = await fetch(path, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(errorMessage(payload, response.status), response.status);
    }

    return payload as T;
}

function errorMessage(payload: unknown, status: number): string {
    if (payload && typeof payload === 'object') {
        const { errors, message } = payload as { errors?: Record<string, string[]>; message?: string };
        const firstError = errors ? Object.values(errors)[0]?.[0] : undefined;

        if (firstError) {
            return firstError;
        }

        if (message) {
            return message;
        }
    }

    if (status === 0 || status >= 500) {
        return 'The party server is not reachable right now.';
    }

    return 'Something went wrong.';
}
