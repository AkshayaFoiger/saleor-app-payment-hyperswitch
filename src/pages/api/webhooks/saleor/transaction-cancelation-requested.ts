import { uuidv7 } from "uuidv7";

import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";
import { type PageConfig } from "next";
import { saleorApp } from "@/saleor-app";
import {
  UntypedTransactionCancelationRequestedDocument,
  type TransactionCancelationRequestedEventFragment,
  TransactionEventTypeEnum,
} from "generated/graphql";
import { getSyncWebhookHandler } from "@/backend-lib/api-route-utils";
import { TransactionCancelationRequestedHyperswitchWebhookHandler } from "@/modules/webhooks/hyperswitch/transaction-cancelation-requested";
import ValidateTransactionCancelationRequestedResponse from "@/schemas/HyperswitchTransactionCancelationRequested/HyperswitchTransactionCancelationRequestedResponse.mjs";
import { TransactionCancelationRequestedJuspayWebhookHandler } from "@/modules/webhooks/juspay/transaction-cancelation-requested";
import { TransactionCancelationRequestedConfigHandler } from "@/modules/webhooks/utils/config-handlers";

export const config: PageConfig = {
  api: {
    bodyParser: false,
  },
};

export const transactionCancelationRequestedSyncWebhook =
  new SaleorSyncWebhook<TransactionCancelationRequestedEventFragment>({
    name: "TransactionCancelationRequested",
    apl: saleorApp.apl,
    event: "TRANSACTION_CANCELATION_REQUESTED",
    query: UntypedTransactionCancelationRequestedDocument,
    webhookPath: "/api/webhooks/saleor/transaction-cancelation-requested",
  });

export default transactionCancelationRequestedSyncWebhook.createHandler(
  getSyncWebhookHandler(
    "transactionCancelationRequestedSyncWebhook",
    TransactionCancelationRequestedConfigHandler,
    TransactionCancelationRequestedHyperswitchWebhookHandler,
    TransactionCancelationRequestedJuspayWebhookHandler,
    ValidateTransactionCancelationRequestedResponse,
    (payload, errorResponse) => {
      return {
        message: errorResponse.message,
        result: TransactionEventTypeEnum.CancelFailure,
        pspReference: payload.transaction?.pspReference,
      } as const;
    },
  ),
);
