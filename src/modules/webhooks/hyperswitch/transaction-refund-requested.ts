import { getWebhookPaymentAppConfigurator } from "../../payment-app-configuration/payment-app-configuration-factory";
import { TransactionRefundRequestedEventFragment } from "generated/graphql";
import { invariant } from "@/lib/invariant";
import { createLogger } from "@/lib/logger";
import { type HyperswitchTransactionRefundRequestedResponse } from "@/schemas/HyperswitchTransactionRefundRequested/HyperswitchTransactionRefundRequestedResponse.mjs";
import {
  getHyperswitchAmountFromSaleorMoney,
  getSaleorAmountFromHyperswitchAmount,
} from "../../hyperswitch/currencies";
import { createHyperswitchClient } from "../../hyperswitch/hyperswitch-api";
import { type components as paymentsComponents } from "generated/hyperswitch-payments";
import { intoRefundResponse } from "../../hyperswitch/hyperswitch-api-response";
import { ConfigObject } from "@/backend-lib/api-route-utils";

export type PaymentRefundResponse = {
  status: string;
};

export const hyperswitchRefundToTransactionResult = (
  status: string,
): HyperswitchTransactionRefundRequestedResponse["result"] | null => {
  switch (status) {
    case "succeeded":
      return "REFUND_SUCCESS";
    case "failed":
      return "REFUND_FAILURE";
    case "pending":
      return undefined;
    default:
      return null;
  }
};

export const TransactionRefundRequestedHyperswitchWebhookHandler = async (
  event: TransactionRefundRequestedEventFragment,
  saleorApiUrl: string,
  configData: ConfigObject,
): Promise<HyperswitchTransactionRefundRequestedResponse> => {
  const logger = createLogger(
    { saleorApiUrl },
    { msgPrefix: "[TransactionRefundRequestedWebhookHandler] " },
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
  invariant(event.transaction, "Missing sourceObject");
  const sourceObject = event.transaction.sourceObject;
  invariant(sourceObject?.total.gross.currency, "Missing Currency");
  const amount = getHyperswitchAmountFromSaleorMoney(
    event.action.amount,
    sourceObject?.total.gross.currency,
  );
  const payment_id = event.transaction.pspReference;
  const channelId = sourceObject.channel.id;
  const hyperswitchClient = await createHyperswitchClient({
    configData,
  });

  const refundHyperswitchPayment = hyperswitchClient.path("/refunds").method("post").create();

  const refundPayload: paymentsComponents["schemas"]["RefundRequest"] = {
    payment_id,
    amount,
    metadata: {
      transaction_id: event.transaction.id,
      saleor_api_url: saleorApiUrl,
    },
  };

  const refundPaymentResponse = await refundHyperswitchPayment(refundPayload);

  const refundPaymentResponseData = intoRefundResponse(refundPaymentResponse.data);
  const result = hyperswitchRefundToTransactionResult(refundPaymentResponseData.status);

  const transactionRefundRequestedResponse: HyperswitchTransactionRefundRequestedResponse =
    result === undefined
      ? {
          pspReference: refundPaymentResponseData.refund_id,
          message: "pending",
        }
      : result === null
        ? {
            pspReference: refundPaymentResponseData.payment_id,
            message: `Unexpected status: ${refundPaymentResponseData.status} recieved from hyperswitch. Please check the payment flow.`,
          }
        : {
            pspReference: refundPaymentResponseData.refund_id,
            result,
            amount: getSaleorAmountFromHyperswitchAmount(
              refundPaymentResponseData.amount,
              refundPaymentResponseData.currency,
            ),
          };
  return transactionRefundRequestedResponse;
};
