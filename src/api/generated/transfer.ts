/* Generated from transfer-orchestrator/src/main/resources/openapi/transfer-service.openapi.yaml at backend revision c141c0d084db0cb1f0b22ab7ad503accd90479c1. Do not edit. */

export interface paths {
    "/v1/transfers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** My transfers */
        get: operations["listTransfers"];
        put?: never;
        /** Send money to a user */
        post: operations["createTransfer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/transfers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        /** Detail + saga timeline */
        get: operations["getTransfer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/transfers/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Confirm a BLOCKED transfer after verification (simulated 3-DS-like) */
        post: operations["confirmBlockedTransfer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request money from a contact */
        post: operations["createPaymentRequest"];
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
        Money: {
            /** @example EUR */
            currency: string;
            /** @example 80.00 */
            amount: string;
        };
        /** @enum {string} */
        TransferStatus: "INITIATED" | "RESERVED" | "SCREENING" | "CLEARED" | "POSTED" | "SETTLED" | "FAILED" | "BLOCKED" | "REVERSED";
        CreateTransferRequest: {
            /** @description the recipient's user id; a client that knows only a handle resolves it first with the ledger's GET /v1/users/lookup */
            toUserId: string;
            amount: components["schemas"]["Money"];
            note?: string;
        };
        Transfer: {
            /** Format: uuid */
            id: string;
            senderId: string;
            recipientId?: string;
            amount: components["schemas"]["Money"];
            note?: string;
            status: components["schemas"]["TransferStatus"];
            /** @description Code of the failure, given to the sender only: null for the recipient. */
            failureReason?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt?: string;
        };
        SagaStep: {
            /** Format: date-time */
            at?: string;
            /**
             * @example RESERVE
             * @example SCREEN
             * @example POST
             * @example RELEASE
             * @example REVERSE
             */
            step?: string;
            /**
             * @example OK
             * @example RETRY
             * @example FAILED
             * @example COMPENSATED
             */
            outcome?: string;
        };
        TransferDetail: components["schemas"]["Transfer"] & {
            /** @description Steps of the saga, given to the sender only: empty for the recipient. */
            steps?: components["schemas"]["SagaStep"][];
            /**
             * Format: date-time
             * @description Instant by which the sender must confirm, given to the sender while the transfer is BLOCKED: null otherwise and for the recipient.
             */
            confirmationDeadline?: string | null;
        };
        Problem: {
            /**
             * Format: uri
             * @default about:blank
             */
            type: string;
            title?: string;
            status?: number;
            detail?: string;
            /**
             * @example IDEMPOTENCY_KEY_REUSED
             * @example TRANSFER_NOT_FOUND
             */
            code?: string;
        };
    };
    responses: {
        /** @description Error (RFC 9457) */
        Problem: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        IdempotencyKey: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listTransfers: {
        parameters: {
            query?: {
                direction?: "SENT" | "RECEIVED" | "ALL";
                status?: components["schemas"]["TransferStatus"];
                cursor?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["Transfer"][];
                        nextCursor?: string | null;
                    };
                };
            };
        };
    };
    createTransfer: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateTransferRequest"];
            };
        };
        responses: {
            /** @description transfer accepted, new or the existing one of a repeated send (reservation in progress or done) */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transfer"];
                };
            };
            /** @description Refused: IDEMPOTENCY_KEY_REUSED. The ledger is not called before the 202: a refusal of the ledger (insufficient funds, unknown recipient) ends the transfer FAILED with its reason. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    getTransfer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description transfer */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransferDetail"];
                };
            };
            404: components["responses"]["Problem"];
        };
    };
    confirmBlockedTransfer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    verificationToken: string;
                };
            };
        };
        responses: {
            /** @description saga resumes */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transfer"];
                };
            };
            404: components["responses"]["Problem"];
            409: components["responses"]["Problem"];
            410: components["responses"]["Problem"];
            422: components["responses"]["Problem"];
        };
    };
    createPaymentRequest: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    fromUserId: string;
                    amount: components["schemas"]["Money"];
                    note?: string;
                };
            };
        };
        responses: {
            /** @description request created (notifies the contact) */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        requestId?: string;
                        /** @enum {string} */
                        status?: "PENDING" | "PAID" | "DECLINED" | "EXPIRED";
                    };
                };
            };
        };
    };
}
