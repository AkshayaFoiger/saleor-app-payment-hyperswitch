import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";
import { type PageConfig } from "next";
import { saleorApp } from "@/saleor-app";
import {
  UntypedTransactionProcessSessionDocument,
  type TransactionProcessSessionEventFragment,
  TransactionEventTypeEnum,
  TransactionFlowStrategyEnum,
} from "generated/graphql";
import { getSyncWebhookHandler } from "@/backend-lib/api-route-utils";
import { TransactionProcessSessionHyperswitchWebhookHandler } from "@/modules/webhooks/hyperswitch/transaction-process-session";
import ValidateTransactionProcessSessionResponse from "@/schemas/HyperswitchTransactionProcessSession/HyperswitchTransactionProcessSessionResponse.mjs";
import { TransactionProcessSessionConfigHandler } from "@/modules/webhooks/utils/config-handlers";
import { TransactionProcessSessionJuspayWebhookHandler } from "@/modules/webhooks/juspay/transaction-process-session";

export const config: PageConfig = {
  api: {
    bodyParser: false,
  },
};

export const transactionProcessSessionSyncWebhook =
  new SaleorSyncWebhook<TransactionProcessSessionEventFragment>({
    name: "TransactionProcessSession",
    apl: saleorApp.apl,
    event: "TRANSACTION_PROCESS_SESSION",
    query: UntypedTransactionProcessSessionDocument,
    webhookPath: "/api/webhooks/saleor/transaction-process-session",
  });

export default transactionProcessSessionSyncWebhook.createHandler(
  getSyncWebhookHandler(
    "transactionProcessSessionSyncWebhook",
    TransactionProcessSessionConfigHandler,
    TransactionProcessSessionHyperswitchWebhookHandler,
    TransactionProcessSessionJuspayWebhookHandler,
    ValidateTransactionProcessSessionResponse,
    (payload, errorResponse) => {
      return {
        amount: 0,
        result:
          payload.action.actionType === TransactionFlowStrategyEnum.Authorization
            ? TransactionEventTypeEnum.AuthorizationFailure
            : TransactionEventTypeEnum.ChargeFailure,
        message: errorResponse.message,
        data: { errors: errorResponse.errors, klarnaOrderResponse: {} },
        // @todo consider making pspReference optional https://github.com/saleor/saleor/issues/12490
        pspReference: payload.transaction.pspReference,
      } as const;
    },
  ),
);
