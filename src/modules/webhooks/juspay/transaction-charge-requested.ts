import { getWebhookPaymentAppConfigurator } from "../../payment-app-configuration/payment-app-configuration-factory";
import { type JuspayTransactionChargeRequestedResponse } from "@/schemas/JuspayTransactionChargeRequested/JuspayTransactionChargeRequestedResponse.mjs";

import { invariant } from "@/lib/invariant";
import { TransactionChargeRequestedEventFragment } from "generated/graphql";
import { intoOrderStatusResponse, intoPreAuthTxnResponse } from "../../juspay/juspay-api-response";
import { createLogger } from "@/lib/logger";
import { SyncWebhookAppErrors } from "@/schemas/HyperswitchTransactionInitializeSession/HyperswitchTransactionInitializeSessionResponse.mjs";
import { createJuspayClient } from "@/modules/juspay/juspay-api";
import { ConfigObject } from "@/backend-lib/api-route-utils";

export const hyperswitchPaymentCaptureStatusToSaleorTransactionResult = (
  status: string,
): JuspayTransactionChargeRequestedResponse["result"] | null => {
  switch (status) {
    case "CHARGED":
    case "PARTIAL_CHARGED":
      return "CHARGE_SUCCESS";
    case "CAPTURE_FAILED":
      return "CHARGE_FAILURE";
    case "CAPTURE_INITIATED":
      return undefined;
    default:
      return null;
  }
};

export const TransactionChargeRequestedJuspayWebhookHandler = async (
  event: TransactionChargeRequestedEventFragment,
  saleorApiUrl: string,
  configData: ConfigObject,
): Promise<JuspayTransactionChargeRequestedResponse> => {
  const logger = createLogger(
    { saleorApiUrl },
    { msgPrefix: "[TransactionChargeRequestedWebhookHandler] " },
  );
  logger.debug(
    {
      transaction: event.transaction,
      action: event.action,
    },
    "Received event",
  );
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  const configurator = getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl);
  invariant(event.transaction, "Missing transaction");

  // Fetch Transaction Details
  invariant(event.transaction.sourceObject, "Missing sourceObject");
  const sourceObject = event.transaction.sourceObject;
  invariant(sourceObject?.total.gross.currency, "Missing Currency");
  const amount_to_capture = event.action.amount;
  const payment_id = event.transaction.pspReference;
  const errors: SyncWebhookAppErrors = [];
  const channelId = sourceObject.channel.id;
  const juspayClient = await createJuspayClient({
    configData,
  });
  const captureJuspayPayment = juspayClient
    .path("/v2/txns/{txn_uuid}/capture")
    .method("post")
    .create();

  const juspayOrderStatus = juspayClient.path("/orders/{order_id}").method("get").create();
  const orderStatusResponse = await juspayOrderStatus({
    order_id: event.transaction.pspReference,
  });
  const parsedOrderStatusRespData = intoOrderStatusResponse(orderStatusResponse.data);
  invariant(parsedOrderStatusRespData.txn_uuid, `Txn_uuid not found in orderstatus response`);

  const capturePaymentResponse = await captureJuspayPayment({
    txn_uuid: parsedOrderStatusRespData.txn_uuid,
  });

  const capturePaymentResponseData = intoPreAuthTxnResponse(capturePaymentResponse.data);

  invariant(
    capturePaymentResponseData.status &&
      capturePaymentResponseData.order_id &&
      capturePaymentResponseData.amount,
    `Required fields not found session call response`,
  );
  const result = hyperswitchPaymentCaptureStatusToSaleorTransactionResult(
    capturePaymentResponseData.status,
  );
  const transactionChargeRequestedResponse: JuspayTransactionChargeRequestedResponse =
    result === undefined
      ? {
          pspReference: capturePaymentResponseData.order_id,
          message: "processing",
        }
      : result === null
        ? {
            pspReference: capturePaymentResponseData.order_id,
            message: `Unexpected status: ${capturePaymentResponseData.status} recieved from hyperswitch. Please check the payment flow.`,
          }
        : {
            result,
            pspReference: capturePaymentResponseData.order_id,
            amount: capturePaymentResponseData.amount,
          };
  return transactionChargeRequestedResponse;
};
