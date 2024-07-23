import * as Sentry from "@sentry/nextjs";

import { type NextApiRequest, type NextApiResponse } from "next";
import type { ValidateFunction } from "ajv";
import { type NextWebhookApiHandler } from "@saleor/app-sdk/handlers/next";
import { createLogger, redactError } from "../lib/logger";
import {
  JsonSchemaError,
  UnknownError,
  BaseError,
  MissingAuthDataError,
  MissingSaleorApiUrlError,
} from "@/errors";
import { toStringOrEmpty } from "@/lib/utils";
import { saleorApp } from "@/saleor-app";
import { z, ZodError } from "zod";
import {
  getConfigurationForChannel,
  PaymentAppConfigurator,
} from "@/modules/payment-app-configuration/payment-app-configuration";

export const validateData = async <S extends ValidateFunction>(data: unknown, validate: S) => {
  type Result = S extends ValidateFunction<infer T> ? T : never;
  try {
    const isValid = validate(data);
    if (!isValid) {
      throw JsonSchemaError.normalize(validate.errors);
    }
    return data as Result;
  } catch (err) {
    throw UnknownError.normalize(err);
  }
};

export function getSyncWebhookHandler<TPayload, TResult, TSchema extends ValidateFunction<TResult>>(
  name: string,
  configHandler: (payload: TPayload, saleorApiUrl: string) => Promise<ConfigObject>,
  webhookHandlerHyperswitch: (
    payload: TPayload,
    saleorApiUrl: string,
    configData: ConfigObject,
  ) => Promise<TResult>,
  webhookHandlerJuspay: (
    payload: TPayload,
    saleorApiUrl: string,
    configData: ConfigObject,
  ) => Promise<TResult>,
  ResponseSchema: TSchema,
  errorMapper: (payload: TPayload, errorResponse: ErrorResponse) => TResult & {},
): NextWebhookApiHandler<TPayload> {
  return async (_req, res: NextApiResponse<Error | TResult>, ctx) => {
    const logger = createLogger(
      {
        event: ctx.event,
      },
      { msgPrefix: `[${name}] ` },
    );
    const { authData, payload } = ctx;
    logger.info(`handler called: ${name}Handler`);
    logger.debug({ payload }, "ctx payload");
    try {
      const configData = await configHandler(payload, authData.saleorApiUrl);
      const orchestra = await getOrchestra(configData);
      const result =
        orchestra == Orchersta.Juspay
          ? await webhookHandlerJuspay(payload, authData.saleorApiUrl, configData)
          : await webhookHandlerHyperswitch(payload, authData.saleorApiUrl, configData);

      logger.info(`${name}Handler was successful`);
      logger.debug({ result }, "Sending successful response");
      return res.json(result);
    } catch (err) {
      logger.error({ err: redactError(err) }, `${name}Handler error`);
      const response = errorToResponse(err);

      if (!response) {
        Sentry.captureException(err);
        const result = BaseError.serialize(err);
        logger.debug("Sending error response");
        return res.status(500).json(result);
      }

      Sentry.captureException(...response.sentry);
      const finalErrorResponse = errorMapper(payload, response);
      logger.debug({ finalErrorResponse }, "Sending error response");
      return res.status(200).json(finalErrorResponse);
    }
  };
}

type ErrorResponse = Exclude<ReturnType<typeof errorToResponse>, null>;
const errorToResponse = (err: unknown) => {
  const normalizedError = err instanceof BaseError ? err : null;
  if (!normalizedError) {
    return null;
  }

  const sentry = [
    normalizedError,
    {
      extra: {
        errors: normalizedError.errors,
      },
    },
  ] as const;

  const message = normalizedError.message;

  const errors = [
    {
      code: normalizedError.name,
      message: normalizedError.message,
    },
    ...(normalizedError.errors?.map((inner) => {
      return {
        code: inner.name,
        message: inner.message,
      };
    }) ?? []),
  ];

  return {
    sentry,
    errors,
    message,
  };
};

export const getAuthDataForRequest = async (request: NextApiRequest) => {
  const logger = createLogger({}, { msgPrefix: "[getAuthDataForRequest] " });

  const saleorApiUrl = toStringOrEmpty(request.query.saleorApiUrl);
  logger.info(`Got saleorApiUrl=${saleorApiUrl || "<undefined>"}`);
  if (!saleorApiUrl) {
    throw new MissingSaleorApiUrlError("Missing saleorApiUrl query param");
  }

  const authData = await saleorApp.apl.get(saleorApiUrl);
  logger.debug({ authData });
  if (!authData) {
    throw new MissingAuthDataError(`APL for ${saleorApiUrl} not found`);
  }

  return authData;
};

enum Orchersta {
  Hyperswitch,
  Juspay,
}

export type ConfigObject = {
  configurator: PaymentAppConfigurator;
  channelId: string;
};

async function getOrchestra<TPayload>(configData: ConfigObject): Promise<Error | Orchersta> {
  const appConfig = await configData.configurator.getConfig();
  const appChannelConfig = getConfigurationForChannel(appConfig, configData.channelId);
  if (!appChannelConfig?.paymentResponseHashKey) {
    return Orchersta.Juspay;
  } else {
    return Orchersta.Hyperswitch;
  }
}
