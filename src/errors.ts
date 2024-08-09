import { type IncomingHttpHeaders } from "node:http2";
import { type TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import ModernError from "modern-errors";
import ModernErrorsSerialize from "modern-errors-serialize";
import { ApiResponse } from "openapi-typescript-fetch";

// Http errors
type CommonProps = {
  errorCode?: string;
  statusCode?: number;
  name?: number;
};

export const BaseError = ModernError.subclass("BaseError", {
  plugins: [ModernErrorsSerialize],
  props: {} as CommonProps,
});
export const UnknownError = BaseError.subclass("UnknownError");
export const JsonSchemaError = BaseError.subclass("JsonSchemaError");
export const MissingSaleorApiUrlError = BaseError.subclass("MissingSaleorApiUrlError");
export const MissingAuthDataError = BaseError.subclass("MissingAuthDataError");
export const ChannelNotConfigured = BaseError.subclass("ChannelNotConfiguredError");
export const UnsupportedEvent = BaseError.subclass("UnsupportedEventError");
export const CheckoutPaymentAlreadyProcessed = BaseError.subclass(
  "CheckoutPaymentAlreadyProcessedError",
);
export const UnExpectedHyperswitchPaymentStatus = BaseError.subclass(
  "UnExpectedHyperswitchPaymentStatusError",
);
export const ConfigurationNotFound = BaseError.subclass("ConfigurationNotFoundError");
export const UnExpectedJuspayPaymentStatus = BaseError.subclass(
  "UnExpectedJuspayPaymentStatusError",
);
export const HyperswitchHttpClientError = BaseError.subclass("HyperswitchHttpClientError");
export const JuspayHttpClientError = BaseError.subclass("JuspayHttpClientError");
export const HttpRequestError = BaseError.subclass("HttpRequestError", {
  props: {} as { statusCode: number; body: string; headers: IncomingHttpHeaders },
});

// TRPC Errors
export interface TrpcErrorOptions {
  /** HTTP response code returned by TRPC */
  trpcCode?: TRPC_ERROR_CODE_KEY;
}
export const BaseTrpcError = BaseError.subclass("BaseTrpcError", {
  props: { trpcCode: "INTERNAL_SERVER_ERROR" } as TrpcErrorOptions,
});
export const JwtTokenExpiredError = BaseTrpcError.subclass("JwtTokenExpiredError", {
  props: { trpcCode: "UNAUTHORIZED" } as TrpcErrorOptions,
});
export const JwtInvalidError = BaseTrpcError.subclass("JwtInvalidError", {
  props: { trpcCode: "UNAUTHORIZED" } as TrpcErrorOptions,
});
export const ReqMissingSaleorApiUrlError = BaseTrpcError.subclass("ReqMissingSaleorApiUrlError", {
  props: { trpcCode: "BAD_REQUEST" } as TrpcErrorOptions,
});
export const ReqMissingAuthDataError = BaseTrpcError.subclass("ReqMissingSaleorApiUrlError", {
  props: { trpcCode: "UNAUTHORIZED" } as TrpcErrorOptions,
});
export const ReqMissingTokenError = BaseTrpcError.subclass("ReqMissingTokenError", {
  props: { trpcCode: "BAD_REQUEST" } as TrpcErrorOptions,
});
export const ReqMissingAppIdError = BaseTrpcError.subclass("ReqMissingAppIdError", {
  props: { trpcCode: "BAD_REQUEST" } as TrpcErrorOptions,
});

// TRPC + react-hook-form errors
export interface FieldErrorOptions extends TrpcErrorOptions {
  fieldName: string;
}

export const FieldError = BaseTrpcError.subclass("FieldError", {
  props: {} as FieldErrorOptions,
});
export const RestrictedKeyNotSupportedError = FieldError.subclass(
  "RestrictedKeyNotSupportedError",
  {
    props: { fieldName: "secretKey" } as FieldErrorOptions,
  },
);
export const InvalidSecretKeyError = FieldError.subclass("InvalidSecretKeyError", {
  props: { fieldName: "secretKey" } as FieldErrorOptions,
});
export const UnexpectedSecretKeyError = FieldError.subclass("UnexpectedSecretKeyError", {
  props: { fieldName: "secretKey" } as FieldErrorOptions,
});
export const InvalidPublishableKeyError = FieldError.subclass("InvalidPublishableKeyError", {
  props: { fieldName: "publishableKey" } as FieldErrorOptions,
});
export const UnexpectedPublishableKeyError = FieldError.subclass("UnexpectedPublishableKeyError", {
  props: { fieldName: "publishableKey" } as FieldErrorOptions,
});

export const FileReaderError = BaseError.subclass("FileReaderError");

export declare class ApiError extends Error {
  readonly headers: Headers;
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly data: any;
  constructor(response: Omit<ApiResponse, "ok">);
}
