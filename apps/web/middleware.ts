/**
 * @file middleware.ts — Next.js Edge Middleware
 *
 * Protects all dashboard routes from unauthenticated access.
 * Runs on every request to the matched paths before any page renders.
 *
 * Token is read from the `cdo_token` cookie (set by session.ts on login).
 * If the cookie is absent, the user is redirected to /login.
 *
 * NOTE: This does NOT verify the JWT signature — that is the API server's job.
 * It provides a UX-level guard that prevents the blank-loading-state problem
 * when an unauthenticated user lands on a protected route.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Routes that don't require authentication */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes through unconditionally
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Allow Next.js internals and static assets
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.startsWith('/api') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Check for auth token in cookies
    const token = request.cookies.get('cdo_token')?.value;

    if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Token present — let the request through
    return NextResponse.next();
}

export const config = {
    // Match everything except public Next.js internals
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
