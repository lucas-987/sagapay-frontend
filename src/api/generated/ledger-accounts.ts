/* Generated from ledger-accounts-service/src/main/resources/openapi/ledger-accounts-service.openapi.yaml at backend revision c141c0d084db0cb1f0b22ab7ad503accd90479c1. Do not edit. */

export interface paths {
    "/v1/wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My balance
         * @description The wallet of the caller: the account is the subject of the bearer token, and a request cannot name another one.
         */
        get: operations["getWallet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/wallet/postings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My ledger postings (append-only, cursor pagination)
         * @description The postings of the caller's own account, taken from the subject of the bearer token, as on GET /v1/wallet.
         */
        get: operations["listPostings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Resolve a handle to an account (recipient preview before a transfer)
         * @description Simplified subset of user-profile-service's lookupRecipient (see contracts/openapi-reference/user-profile-service.openapi.yaml), served by ledger-accounts-service because accounts already carry a handle and a display name. Exact handle match only; never returns balance or currency.
         */
        get: operations["lookupAccount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/names": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Display names of accounts, by id (counterparty names of a list)
         * @description Answers the display name of each known account among at most 50 ids, in one request, for any signed-in user: the token's subject is not used. One item per known id, each id once even when repeated, in no guaranteed order; an unknown id is left out. Nothing else about an account is returned. At least one id and at most 50 are required, each a UUID, otherwise 400 with code INVALID_ACCOUNT_IDS.
         */
        get: operations["lookupAccountNames"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description RFC 9457 problem document; code is the application error code. */
        Problem: {
            type?: string;
            title?: string;
            status?: number;
            detail?: string;
            instance?: string;
            code?: string;
        };
        AccountName: {
            /** Format: uuid */
            accountId: string;
            displayName: string;
        };
        Money: {
            currency?: string;
            amount?: string;
        };
        Posting: {
            id?: string;
            entryGroup?: string;
            /** @enum {string} */
            leg?: "DEBIT" | "CREDIT";
            /**
             * @example RESERVE_HOLD
             * @example RELEASE_HOLD
             * @example TRANSFER_SETTLE
             * @example TRANSFER_REVERSE
             */
            reason?: string;
            amount?: components["schemas"]["Money"];
            refTransferId?: string;
            /** Format: date-time */
            createdAt?: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getWallet: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description balance */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        accountId?: string;
                        currency?: string;
                        balance?: components["schemas"]["Money"];
                        available?: components["schemas"]["Money"];
                        held?: components["schemas"]["Money"];
                    };
                };
            };
        };
    };
    listPostings: {
        parameters: {
            query?: {
                from?: string;
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description page of postings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["Posting"][];
                        nextCursor?: string | null;
                    };
                };
            };
        };
    };
    lookupAccount: {
        parameters: {
            query: {
                handle: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description account resolved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        accountId?: string;
                        displayName?: string;
                    };
                };
            };
            /** @description no account has this handle (code RECIPIENT_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    lookupAccountNames: {
        parameters: {
            query?: {
                /** @description Account ids, the parameter repeated once per id (at most 50). */
                ids?: string[];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description names of the known accounts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["AccountName"][];
                    };
                };
            };
            /** @description no id, more than 50 ids, or an id that is not a UUID (code INVALID_ACCOUNT_IDS) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description no token, or a token the realm does not accept */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
