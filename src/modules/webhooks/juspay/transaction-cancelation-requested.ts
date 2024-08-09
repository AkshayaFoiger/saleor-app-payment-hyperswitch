import { type JuspayTransactionCancelationRequestedResponse } from "@/schemas/JuspayTransactionCancelationRequested/JuspayTransactionCancelationRequestedResponse.mjs";
import { type TransactionCancelationRequestedEventFragment } from "generated/graphql";
import { invariant } from "@/lib/invariant";
import { createLogger } from "@/lib/logger";
import { createJuspayClient } from "@/modules/juspay/juspay-api";
import { intoOrderStatusResponse, intoPreAuthTxnResponse } from "../../juspay/juspay-api-response";
import { ConfigObject } from "@/backend-lib/api-route-utils";

export const juspayPaymentCancelStatusToSaleorTransactionResult = (
  status: string,
): JuspayTransactionCancelationRequestedResponse["result"] | null => {
  switch (status) {
    case "VOIDED":
      return "CANCEL_SUCCESS";
    case "VOID_FAILED":
      return "CANCEL_FAILURE";
    case "VOID_INITIATED":
      return undefined;
    default:
      return null;
  }
};

export const TransactionCancelationRequestedJuspayWebhookHandler = async (
  event: TransactionCancelationRequestedEventFragment,
  saleorApiUrl: string,
  configData: ConfigObject,
): Promise<JuspayTransactionCancelationRequestedResponse> => {
  const logger = createLogger(
    { saleorApiUrl },
    { msgPrefix: "[TransactionCancelationRequestedWebhookHandler] " },
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
  invariant(event.transaction, "Missing transaction");
  // Fetch Transaction Details
  invariant(event.transaction.sourceObject, "Missing sourceObject");

  const juspayClient = await createJuspayClient({
    configData,
  });

  const cancelJuspayPayment = juspayClient.path("/v2/txns/{txn_uuid}/void").method("post").create();

  const juspayOrderStatus = juspayClient.path("/orders/{order_id}").method("get").create();
  const orderStatusResponse = await juspayOrderStatus({
    order_id: event.transaction.pspReference,
  });
  const parsedOrderStatusRespData = intoOrderStatusResponse(orderStatusResponse.data);

  invariant(parsedOrderStatusRespData.txn_uuid, `Txn_uuid not found in orderstatus response`);

  const preAuthVoidTxnResponse = await cancelJuspayPayment({
    txn_uuid: parsedOrderStatusRespData.txn_uuid,
  });

  const cancelPaymentResponseData = intoPreAuthTxnResponse(preAuthVoidTxnResponse.data);
  invariant(
    cancelPaymentResponseData.status &&
      cancelPaymentResponseData.order_id &&
      cancelPaymentResponseData.amount,
    `Required fields not found session call response`,
  );
  const result = juspayPaymentCancelStatusToSaleorTransactionResult(
    cancelPaymentResponseData.status,
  );

  const transactionCancelationRequestedResponse: JuspayTransactionCancelationRequestedResponse =
    result === undefined
      ? {
          pspReference: cancelPaymentResponseData.order_id,
          message: "processing",
        }
      : result === null
        ? {
            pspReference: cancelPaymentResponseData.order_id,
            message: `Unexpected status: ${cancelPaymentResponseData.status} recieved from juspay. Please check the payment flow.`,
          }
        : {
            pspReference: cancelPaymentResponseData.order_id,
            result,
            amount: cancelPaymentResponseData.amount,
          };

  return transactionCancelationRequestedResponse;
};
