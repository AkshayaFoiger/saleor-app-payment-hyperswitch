import { type PaymentGatewayInitializeSessionResponse } from "@/schemas/PaymentGatewayInitializeSession/PaymentGatewayInitializeSessionResponse.mjs";
import { type PaymentGatewayInitializeSessionEventFragment } from "generated/graphql";
import { invariant } from "@/lib/invariant";
import { createLogger } from "@/lib/logger";
import { ConfigObject } from "@/backend-lib/api-route-utils";

export const PaymentGatewayInitializeSessionJuspayWebhookHandler = async (
  event: PaymentGatewayInitializeSessionEventFragment,
  saleorApiUrl: string,
  configData: ConfigObject,
): Promise<PaymentGatewayInitializeSessionResponse> => {
  const logger = createLogger(
    {},
    { msgPrefix: "[PaymentGatewayInitializeSessionWebhookHandler] " },
  );

  const app = event.recipient;
  invariant(app, "Missing event.recipient!");

  logger.info({}, "Processing Payment Gateway Initialize request");
  const paymentGatewayInitializeSessionResponse: PaymentGatewayInitializeSessionResponse = {
    data: {},
  };
  return paymentGatewayInitializeSessionResponse;
};
