'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getToken } from '../auth/session';

/**
 * The GraphQL endpoint is set by next.config.js from the root .env
 * (GRAPHQL_SCHEMA_URL → NEXT_PUBLIC_API_URL).
 *
 * Fallback chain (all pointing to localhost:4000 in development):
 *   1. NEXT_PUBLIC_API_URL — populated from root .env by next.config.js
 *   2. http://localhost:4000/graphql — hardcoded default for local dev
 */
const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000/graphql';

const httpLink = createHttpLink({ uri: API_URL });

const authLink = setContext((_, { headers }) => {
    const token = getToken();
    return {
        headers: {
            ...headers,
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
    };
});

const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
        watchQuery: { fetchPolicy: 'cache-and-network' },
    },
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
