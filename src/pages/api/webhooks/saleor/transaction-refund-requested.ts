import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";
import { type PageConfig } from "next";
import { uuidv7 } from "uuidv7";
import {
  UntypedTransactionRefundRequestedDocument,
  type TransactionRefundRequestedEventFragment,
  TransactionEventTypeEnum,
} from "generated/graphql";
import { saleorApp } from "@/saleor-app";
import { getSyncWebhookHandler } from "@/backend-lib/api-route-utils";
import { TransactionRefundRequestedHyperswitchWebhookHandler } from "@/modules/webhooks/hyperswitch/transaction-refund-requested";
import ValidateTransactionRefundRequestedResponse from "@/schemas/TransactionRefundRequested/TransactionRefundRequestedResponse.mjs";
import { TransactionRefundRequestedConfigHandler } from "@/modules/webhooks/utils/config-handlers";
import { TransactionRefundRequestedJuspayWebhookHandler } from "@/modules/webhooks/juspay/transaction-refund-requested";

export const config: PageConfig = {
  api: {
    bodyParser: false,
  },
};

export const transactionRefundRequestedSyncWebhook =
  new SaleorSyncWebhook<TransactionRefundRequestedEventFragment>({
    name: "TransactionRefundRequested",
    apl: saleorApp.apl,
    event: "TRANSACTION_REFUND_REQUESTED",
    query: UntypedTransactionRefundRequestedDocument,
    webhookPath: "/api/webhooks/saleor/transaction-refund-requested",
  });

export default transactionRefundRequestedSyncWebhook.createHandler(
  getSyncWebhookHandler(
    "transactionRefundRequested",
    TransactionRefundRequestedConfigHandler,
    TransactionRefundRequestedHyperswitchWebhookHandler,
    TransactionRefundRequestedJuspayWebhookHandler,
    ValidateTransactionRefundRequestedResponse,
    (payload, errorResponse) => {
      return {
        message: errorResponse.message,
        result: TransactionEventTypeEnum.RefundFailure,
        amount: payload.action.amount,
        // @todo consider making pspReference optional https://github.com/saleor/saleor/issues/12490
        pspReference: payload.transaction?.pspReference,
      } as const;
    },
  ),
);
