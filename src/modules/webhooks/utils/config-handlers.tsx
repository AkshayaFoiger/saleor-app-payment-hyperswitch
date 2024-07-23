import { ConfigObject } from "@/backend-lib/api-route-utils";
import { invariant } from "@/lib/invariant";
import { getWebhookPaymentAppConfigurator } from "@/modules/payment-app-configuration/payment-app-configuration-factory";
import {
  PaymentGatewayInitializeSessionEventFragment,
  TransactionCancelationRequestedEventFragment,
  TransactionChargeRequestedEventFragment,
  TransactionInitializeSessionEventFragment,
  TransactionProcessSessionEventFragment,
  TransactionRefundRequestedEventFragment,
} from "generated/graphql";

export const TransactionInitializeSessionConfigHandler = async (
  event: TransactionInitializeSessionEventFragment,
  saleorApiUrl: string,
): Promise<ConfigObject> => {
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  const appConfig: ConfigObject = {
    configurator: getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl),
    channelId: event.sourceObject.channel.id,
  };
  return appConfig;
};

export const TransactionChargeRequestedConfigHandler = async (
  event: TransactionChargeRequestedEventFragment,
  saleorApiUrl: string,
): Promise<ConfigObject> => {
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  invariant(event.transaction, "Missing transaction");
  invariant(event.transaction.sourceObject, "Missing sourceObject");

  const appConfig: ConfigObject = {
    configurator: getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl),
    channelId: event.transaction.sourceObject.channel.id,
  };
  return appConfig;
};

export const TransactionCancelationRequestedConfigHandler = async (
  event: TransactionCancelationRequestedEventFragment,
  saleorApiUrl: string,
): Promise<ConfigObject> => {
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  invariant(event.transaction, "Missing transaction");
  invariant(event.transaction.sourceObject, "Missing sourceObject");

  const appConfig: ConfigObject = {
    configurator: getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl),
    channelId: event.transaction.sourceObject.channel.id,
  };
  return appConfig;
};

export const PaymentGatewayInitializeSessionConfigHandler = async (
  event: PaymentGatewayInitializeSessionEventFragment,
  saleorApiUrl: string,
): Promise<ConfigObject> => {
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  const appConfig: ConfigObject = {
    configurator: getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl),
    channelId: event.sourceObject.channel.id,
  };
  return appConfig;
};

export const TransactionProcessSessionConfigHandler = async (
  event: TransactionProcessSessionEventFragment,
  saleorApiUrl: string,
): Promise<ConfigObject> => {
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  const { privateMetadata } = app;
  const appConfig: ConfigObject = {
    configurator: getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl),
    channelId: event.sourceObject.channel.id,
  };
  return appConfig;
};

export const TransactionRefundRequestedConfigHandler = async (
  event: TransactionRefundRequestedEventFragment,
  saleorApiUrl: string,
): Promise<ConfigObject> => {
  const app = event.recipient;
  invariant(app, "Missing event.recipient!");
  invariant(event.transaction?.sourceObject, "Missing sourceObject");
  const sourceObject = event.transaction.sourceObject;
  const { privateMetadata } = app;
  const appConfig: ConfigObject = {
    configurator: getWebhookPaymentAppConfigurator({ privateMetadata }, saleorApiUrl),
    channelId: sourceObject.channel.id,
  };
  return appConfig;
};
