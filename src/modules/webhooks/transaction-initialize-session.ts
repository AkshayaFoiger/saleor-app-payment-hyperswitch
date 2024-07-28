import { getWebhookPaymentAppConfigurator } from "../payment-app-configuration/payment-app-configuration-factory";
import { paymentAppFullyConfiguredEntrySchema } from "../payment-app-configuration/common-app-configuration/config-entry";
import { obfuscateConfig, obfuscateValue } from "../app-configuration/utils";
import { getConfigurationForChannel } from "../payment-app-configuration/payment-app-configuration";
import {
  SyncWebhookAppErrors,
  type TransactionInitializeSessionResponse,
} from "@/schemas/TransactionInitializeSession/TransactionInitializeSessionResponse.mjs";
import {
  TransactionFlowStrategyEnum,
  type TransactionInitializeSessionEventFragment,
} from "generated/graphql";
import { invariant } from "@/lib/invariant";
import { createLogger } from "@/lib/logger";
import {
  getHyperswitchAmountFromSaleorMoney,
  getSaleorAmountFromHyperswitchAmount,
} from "../hyperswitch/currencies";
import {
  buildAddressDetails,
  validatePaymentCreateRequest,
} from "../hyperswitch/hyperswitch-api-request";
import {
  ChannelNotConfigured,
  UnExpectedHyperswitchPaymentStatus,
  UnsupportedEvent,
} from "@/errors";
import {
  createHyperswitchClient,
  fetchHyperswitchProfileID,
  fetchHyperswitchPublishableKey,
} from "../hyperswitch/hyperswitch-api";
import { type components as paymentsComponents } from "generated/hyperswitch-payments";
import { Channel } from "../../types";
import {
  intoPaymentResponse,
  PaymentResponseSchema,
} from "../hyperswitch/hyperswitch-api-response";
import { normalizeValue } from "../payment-app-configuration/utils";

export const hyperswitchPaymentIntentToTransactionResult = (
  status: string,
  transactionFlow: TransactionFlowStrategyEnum,
): TransactionInitializeSessionResponse["result"] => {
  const prefix =
    transactionFlow === TransactionFlowStrategyEnum.Authorization
      ? "AUTHORIZATION"
      : transactionFlow === TransactionFlowStrategyEnum.Charge
        ? "CHARGE"
        : null;

  invariant(prefix, `Unsupported transactionFlowStrategy: ${transactionFlow}`);

  switch (status) {
    case "requires_payment_method":
      return `${prefix}_ACTION_REQUIRED`;
    case "requires_capture":
      return "AUTHORIZATION_SUCCESS";
    case "failed":
    case "cancelled":
      return `${prefix}_FAILURE`;
    case "processing":
      return `${prefix}_REQUEST`;
    default:
      throw new UnExpectedHyperswitchPaymentStatus(
        `Status received from hyperswitch: ${status}, is not expected . Please check the payment flow.`,
      );
  }
};

export const TransactionInitializeSessionWebhookHandler = async (
  event: TransactionInitializeSessionEventFragment,
  saleorApiUrl: string,
): Promise<TransactionInitializeSessionResponse> => {
  const logger = createLogger(
    { saleorApiUrl },
    { msgPrefix: "[TransactionInitializeSessionWebhookHandler] " },
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
  const currency = event.action.currency;
  const amount = getHyperswitchAmountFromSaleorMoney(event.action.amount, currency);
  let requestData = null;
  if (event.data != null) {
    requestData = validatePaymentCreateRequest(event.data);
  }
  const channelId = event.sourceObject.channel.id;

  const hyperswitchClient = await createHyperswitchClient({
    configurator,
    channelId,
  });

  const profileId = await fetchHyperswitchProfileID(configurator, channelId);

  const createHyperswitchPayment = hyperswitchClient.path("/payments").method("post").create();
  const capture_method =
    event.action.actionType == TransactionFlowStrategyEnum.Authorization ? "manual" : "automatic";

  const userEmail = requestData?.billingEmail
    ? requestData?.billingEmail
    : event.sourceObject.userEmail;

  const createPaymentPayload: paymentsComponents["schemas"]["PaymentsCreateRequest"] = {
    amount,
    confirm: false,
    currency: currency as paymentsComponents["schemas"]["PaymentsCreateRequest"]["currency"],
    capture_method,
    profile_id: profileId,
    email: normalizeValue(userEmail),
    statement_descriptor_name: normalizeValue(requestData?.statementDescriptorName),
    statement_descriptor_suffix: normalizeValue(requestData?.statementDescriptorSuffix),
    customer_id: normalizeValue(requestData?.customerId),
    authentication_type: normalizeValue(requestData?.authenticationType),
    return_url: normalizeValue(requestData?.returnUrl),
    description: normalizeValue(requestData?.description),
    billing: buildAddressDetails(event.sourceObject.billingAddress, userEmail),
    shipping: buildAddressDetails(event.sourceObject.shippingAddress, requestData?.shippingEmail),
    metadata: {
      transaction_id: event.transaction.id,
      saleor_api_url: saleorApiUrl,
    },
  };

  const publishableKey = await fetchHyperswitchPublishableKey(configurator, channelId);

  const createPaymentResponse = await createHyperswitchPayment(createPaymentPayload);
  const createPaymentResponseData = intoPaymentResponse(createPaymentResponse.data);
  const result = hyperswitchPaymentIntentToTransactionResult(
    createPaymentResponseData.status,
    event.action.actionType,
  );
  const transactionInitializeSessionResponse: TransactionInitializeSessionResponse = {
    data: {
      clientSecret: createPaymentResponseData.client_secret,
      publishableKey,
      errors,
    },
    pspReference: createPaymentResponseData.payment_id,
    result,
    amount: getSaleorAmountFromHyperswitchAmount(
      createPaymentResponseData.amount,
      createPaymentResponseData.currency,
    ),
    time: new Date().toISOString(),
  };
  return transactionInitializeSessionResponse;
};
