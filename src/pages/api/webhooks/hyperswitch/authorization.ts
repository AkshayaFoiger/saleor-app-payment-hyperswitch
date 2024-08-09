import {
  BaseError,
  ChannelNotConfigured,
  HttpRequestError,
  HyperswitchHttpClientError,
  UnExpectedHyperswitchPaymentStatus,
} from "@/errors";
import { headers } from "next/headers";
import { createClient } from "@/lib/create-graphq-client";
import { invariant } from "@/lib/invariant";
import {
  intoPaymentResponse,
  intoRefundResponse,
  intoWebhookResponse,
  CaptureMethod,
  WebhookResponse,
} from "@/modules/hyperswitch/hyperswitch-api-response";
import { saleorApp } from "@/saleor-app";
import {
  GetTransactionByIdDocument,
  GetTransactionByIdQuery,
  GetTransactionByIdQueryVariables,
  TransactionActionEnum,
  TransactionEventReportDocument,
  TransactionEventTypeEnum,
} from "generated/graphql";
import { NextApiRequest, NextApiResponse } from "next";
import { Event } from "../../../../../generated/graphql";
import { getPaymentAppConfigurator } from "@/modules/payment-app-configuration/payment-app-configuration-factory";
import { getConfigurationForChannel } from "@/modules/payment-app-configuration/payment-app-configuration";
import { paymentAppFullyConfiguredEntrySchema } from "@/modules/payment-app-configuration/common-app-configuration/config-entry";
import {
  createHyperswitchClient,
  fetchHyperswitchPaymentResponseHashKey,
} from "@/modules/hyperswitch/hyperswitch-api";
import { getSaleorAmountFromHyperswitchAmount } from "@/modules/hyperswitch/currencies";
import crypto from "crypto";
import { result } from "lodash-es";
import { createLogger, logger } from "@/lib/logger";
import { ConfigObject } from "@/backend-lib/api-route-utils";

export const hyperswitchStatusToSaleorTransactionResult = (
  status: string,
  isRefund: boolean,
  captureMethod: CaptureMethod | undefined | null,
  isChargeFlow: boolean | undefined,
): TransactionEventTypeEnum => {
  switch (status) {
    case "succeeded":
      if (isRefund) {
        return TransactionEventTypeEnum.RefundSuccess;
      } else {
        return TransactionEventTypeEnum.ChargeSuccess;
      }
    case "failed":
    case "RouterDeclined":
      if (isRefund) {
        return TransactionEventTypeEnum.RefundFailure;
      } else if (captureMethod == "manual" && !isChargeFlow) {
        return TransactionEventTypeEnum.AuthorizationFailure;
      } else {
        return TransactionEventTypeEnum.ChargeFailure;
      }
    case "partially_captured_and_capturable":
    case "partially_captured":
      return TransactionEventTypeEnum.ChargeSuccess;
    case "requires_capture":
      return TransactionEventTypeEnum.AuthorizationSuccess;
    case "cancelled":
      return TransactionEventTypeEnum.CancelSuccess;
    case "requires_payment_method":
    case "requires_customer_action":
    case "requires_confirmation":
      if (captureMethod == "manual") {
        return TransactionEventTypeEnum.AuthorizationActionRequired;
      } else {
        return TransactionEventTypeEnum.ChargeActionRequired;
      }
    default:
      throw new UnExpectedHyperswitchPaymentStatus(
        `Status received from hyperswitch: ${status}, is not expected . Please check the payment flow.`,
      );
  }
};

export const verifyWebhookSource = (
  req: NextApiRequest,
  paymentResponseHashKey: string,
): boolean => {
  const signature = req.headers["x-webhook-signature-512"];
  invariant(signature, "Failed fetching webhook signature");
  const hmac = crypto.createHmac("sha512", paymentResponseHashKey);
  hmac.update(JSON.stringify(req.body));
  const computedHash = hmac.digest("hex");
  if (Array.isArray(signature)) {
    // If signature is an array, check if the computed hash matches any element in the array
    return signature.includes(computedHash);
  } else {
    // If signature is a string, directly compare with the computed hash
    return computedHash === signature;
  }
};

const getAvailableActions = (
  transactionType: TransactionEventTypeEnum,
): TransactionActionEnum[] => {
  switch (transactionType) {
    case TransactionEventTypeEnum.AuthorizationSuccess:
      return [TransactionActionEnum.Cancel, TransactionActionEnum.Charge];
    case TransactionEventTypeEnum.ChargeSuccess:
      return [TransactionActionEnum.Refund];
    default:
      return [];
  }
};

export const getRefundId = (webhookBody: WebhookResponse): string => {
  invariant(webhookBody.content.object.refund_id, "No Refund Id");
  return webhookBody.content.object.refund_id;
};

export default async function hyperswitchAuthorizationWebhookHandler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const logger = createLogger({ msgPrefix: "[HyperswitchWebhookHandler]" });
  let webhookBody = intoWebhookResponse(req.body);

  const transactionId = webhookBody.content.object.metadata.transaction_id;
  const saleorApiUrl = webhookBody.content.object.metadata.saleor_api_url;
  const isRefund = webhookBody.content.type === "refund_details";

  const authData = await saleorApp.apl.get(saleorApiUrl);
  if (authData === undefined) {
    res.status(401).json("Failed fetching auth data, check your Saleor API URL");
  }
  invariant(authData, "Failed fetching auth data");
  const client = createClient(saleorApiUrl, async () => ({ token: authData?.token }));
  const transaction = await client
    .query<GetTransactionByIdQuery, GetTransactionByIdQueryVariables>(GetTransactionByIdDocument, {
      transactionId,
    })
    .toPromise();

  const sourceObject =
    transaction.data?.transaction?.checkout ?? transaction.data?.transaction?.order;

  let isChargeFlow = transaction.data?.transaction?.events.some(
    (event) => event.type === "AUTHORIZATION_SUCCESS",
  );

  invariant(sourceObject, "Missing Source Object");

  const configData: ConfigObject = {
    configurator: getPaymentAppConfigurator(client, saleorApiUrl),
    channelId: sourceObject.channel.id,
  };

  let paymentResponseHashKey = null;
  try {
    paymentResponseHashKey = await fetchHyperswitchPaymentResponseHashKey(configData);
  } catch (errorData) {
    return res.status(406).json("Channel not assigned");
  }

  if (!verifyWebhookSource(req, paymentResponseHashKey)) {
    return res.status(400).json("Source Verification Failed");
  }
  logger.info("Webhook Source Verified");
  const payment_id = webhookBody.content.object.payment_id;
  const refund_id = webhookBody.content.object.refund_id;

  let hyperswitchClient = null;
  try {
    hyperswitchClient = await createHyperswitchClient({
      configData,
    });
  } catch (errorData) {
    if (errorData instanceof HyperswitchHttpClientError && errorData.statusCode != undefined) {
      return res.status(errorData.statusCode).json(errorData.name);
    } else {
      return res.status(424).json("Sync called failed");
    }
  }

  let hyperswitchSyncResponse = null;
  let pspReference = null;
  if (isRefund) {
    const paymentSync = hyperswitchClient.path("/refunds/{refund_id}").method("get").create();

    invariant(refund_id, "Missing refund id");

    const refundSyncResponse = await paymentSync({
      ...{},
      refund_id,
    });
    hyperswitchSyncResponse = intoRefundResponse(refundSyncResponse.data);
    pspReference = hyperswitchSyncResponse.refund_id;
  } else {
    const paymentSync = hyperswitchClient.path("/payments/{payment_id}").method("get").create();

    const paymentSyncResponse = await paymentSync({
      ...{},
      payment_id,
    });
    hyperswitchSyncResponse = intoPaymentResponse(paymentSyncResponse.data);
    pspReference = hyperswitchSyncResponse.payment_id;
  }
  const captureMethod = webhookBody.content.object.capture_method;

  const type = hyperswitchStatusToSaleorTransactionResult(
    webhookBody.content.object.status,
    isRefund,
    captureMethod,
    isChargeFlow,
  );
  await client
    .mutation(TransactionEventReportDocument, {
      transactionId,
      amount: getSaleorAmountFromHyperswitchAmount(
        hyperswitchSyncResponse.amount,
        hyperswitchSyncResponse.currency,
      ),
      availableActions: getAvailableActions(type),
      externalUrl: "",
      time: new Date().toISOString(),
      type,
      pspReference: isRefund ? getRefundId(webhookBody) : webhookBody.content.object.payment_id,
      message: webhookBody.content.object.error_message
        ? webhookBody.content.object.error_message
        : "",
    })
    .toPromise();

  res.status(200).json("[OK]");
}
