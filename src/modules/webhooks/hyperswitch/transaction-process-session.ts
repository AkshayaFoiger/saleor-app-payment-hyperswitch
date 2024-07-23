import {
  SyncWebhookAppErrors,
  type TransactionProcessSessionResponse,
} from "@/schemas/TransactionProcessSession/TransactionProcessSessionResponse.mjs";
import { invariant } from "@/lib/invariant";
import { type JSONObject } from "@/types";
import { createLogger } from "@/lib/logger";
import { obfuscateConfig } from "@/modules/app-configuration/utils";
import { getConfigurationForChannel } from "@/modules/payment-app-configuration/payment-app-configuration";
import {
  TransactionFlowStrategyEnum,
  type TransactionProcessSessionEventFragment,
} from "generated/graphql";

import { paymentAppFullyConfiguredEntrySchema } from "@/modules/payment-app-configuration/config-entry";
import { getWebhookPaymentAppConfigurator } from "@/modules/payment-app-configuration/payment-app-configuration-factory";
import {
  ChannelNotConfigured,
  UnExpectedHyperswitchPaymentStatus,
  UnsupportedEvent,
} from "@/errors";
import {
  getHyperswitchAmountFromSaleorMoney,
  getSaleorAmountFromHyperswitchAmount,
} from "../../hyperswitch/currencies";
import { createHyperswitchClient } from "../../hyperswitch/hyperswitch-api";
import { type components as paymentsComponents } from "generated/hyperswitch-payments";
import { validatePaymentCreateRequest } from "../../hyperswitch/hyperswitch-api-request";
import { intoPaymentResponse } from "../../hyperswitch/hyperswitch-api-response";
import { hyperswitchPaymentIntentToTransactionResult } from "./transaction-initialize-session";
import { hyperswitchStatusToSaleorTransactionResult } from "@/pages/api/webhooks/hyperswitch/authorization";
import { ConfigObject } from "@/backend-lib/api-route-utils";

export const hyperswitchPaymentIntentToTransactionProcessResult = (
  status: string,
  transactionFlow: TransactionFlowStrategyEnum,
): TransactionProcessSessionResponse["result"] => {
  const prefix =
    transactionFlow === TransactionFlowStrategyEnum.Authorization
      ? "AUTHORIZATION"
      : transactionFlow === TransactionFlowStrategyEnum.Charge
        ? "CHARGE"
        : null;

  invariant(prefix, `Unsupported transactionFlowStrategy: ${transactionFlow}`);

  switch (status) {
    case "succeeded":
    case "partially_captured_and_capturable":
    case "partially_captured":
      return `${prefix}_SUCCESS`;
    case "failed":
    case "cancelled":
      return `${prefix}_FAILURE`;
    case "requires_capture":
      return "AUTHORIZATION_SUCCESS";
    case "requires_payment_method":
    case "requires_customer_action":
    case "requires_confirmation":
      return `${prefix}_ACTION_REQUIRED`;
    case "processing":
      return `${prefix}_REQUEST`;
    default:
      throw new UnExpectedHyperswitchPaymentStatus(
        `Status received from hyperswitch: ${status}, is not expected . Please check the payment flow.`,
      );
  }
};

export const TransactionProcessSessionHyperswitchWebhookHandler = async (
  event: TransactionProcessSessionEventFragment,
  saleorApiUrl: string,
  configData: ConfigObject,
): Promise<TransactionProcessSessionResponse> => {
  const logger = createLogger(
    { saleorApiUrl },
    { msgPrefix: "[TransactionProcessSessionWebhookHandler] " },
  );
  logger.debug(
    {
      transaction: event.transaction,
      action: event.action,
      sourceObject: {
        id: event.sourceObject.id,
        channel: event.sourceObject.channel,
        __typename: event.sourceObject.__typename,
      },
      merchantReference: event.merchantReference,
    },
    "Received event",
  );

  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  const configurator = getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl);
  const errors: SyncWebhookAppErrors = [];
  const channelId = event.sourceObject.channel.id;
  const hyperswitchClient = await createHyperswitchClient({
    configData,
  });

  const retrieveHyperswitchPayment = hyperswitchClient
    .path("/payments/{payment_id}")
    .method("get")
    .create();

  const resource_id: paymentsComponents["schemas"]["PaymentIdType"] = {
    PaymentIntentId: event.transaction.pspReference,
  };

  const capture_method =
    event.action.actionType == TransactionFlowStrategyEnum.Authorization ? "manual" : "automatic";

  const retrievePaymentPayload: paymentsComponents["schemas"]["PaymentsRetrieveRequest"] = {
    force_sync: true,
    resource_id,
  };

  const payment_id = event.transaction.pspReference;

  const retrievePaymentResponse = await retrieveHyperswitchPayment({
    ...retrievePaymentPayload,
    payment_id,
  });
  const retrievePaymentResponseData = intoPaymentResponse(retrievePaymentResponse.data);

  const result = hyperswitchPaymentIntentToTransactionProcessResult(
    retrievePaymentResponseData.status,
    event.action.actionType,
  );
  const transactionProcessSessionResponse: TransactionProcessSessionResponse = {
    data: {
      errors,
    },
    pspReference: retrievePaymentResponseData.payment_id,
    result,
    amount: getSaleorAmountFromHyperswitchAmount(
      retrievePaymentResponseData.amount,
      retrievePaymentResponseData.currency,
    ),
    time: new Date().toISOString(),
  };
  return transactionProcessSessionResponse;
};
