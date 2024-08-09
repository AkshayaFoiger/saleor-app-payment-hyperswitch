import { z, ZodError } from "zod";
import { JsonSchemaError } from "@/errors";

export const SaleorMetadataSchema = z.object({
  transaction_id: z.string(),
  saleor_api_url: z.string(),
});

export const SessionPaymentlinks = z.object({
  web: z.string().nullable(),
  expiry: z.string().nullable(),
  deep_link: z.string().nullable().optional(),
});

export const Payload = z.object({
  clientId: z.string().nullable().optional(),
  amount: z.string().nullable(),
  merchantId: z.string().nullable().optional(),
  clientAuthToken: z.string().nullable().optional(),
  clientAuthTokenExpiry: z.string().nullable(),
  environment: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  returnUrl: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  orderId: z.string().nullable(),
  description: z.string().nullable().optional(),
});

export const SessionSDKPayload = z.object({
  requestId: z.string(),
  service: z.string(),
  payload: Payload,
  expiry: z.string().nullable(),
});

export const PaymentResponseSchema = z.object({
  status: z.string().nullable(),
  id: z.string().nullable(),
  order_id: z.string().nullable(),
  payment_links: SessionPaymentlinks,
  sdk_payload: SessionSDKPayload,
});

export type PaymentCreateResponse = z.infer<typeof PaymentResponseSchema>;

export function intoPaymentResponse(responseData: any): PaymentCreateResponse {
  try {
    return PaymentResponseSchema.parse(responseData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new JsonSchemaError(`Failed to parse payment create response: ${error}`);
    } else {
      throw error;
    }
  }
}

export const PreAuthPaymentResponse = z.object({
  status: z.string().nullable(),
  order_id: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  txn_uuid: z.string().nullable().optional(),
});

export type PaymentPreAuthResponse = z.infer<typeof PreAuthPaymentResponse>;

export function intoPreAuthTxnResponse(responseData: any): PaymentPreAuthResponse {
  try {
    return PreAuthPaymentResponse.parse(responseData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new JsonSchemaError(`Failed to parse payment void response`);
    } else {
      throw error;
    }
  }
}

export const Refunds = z.object({
  unique_request_id: z.string(),
  amount: z.number(),
  status: z.string(),
  error_message: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  refund_source: z.string().nullable().optional(),
});

export const OrderStatusResponse = z.object({
  status: z.string(),
  order_id: z.string().nullable(),
  amount: z.number().nullable().optional(),
  txn_uuid: z.string().nullable().optional(),
  refunded: z.boolean().nullable().optional(),
  refunds: z.array(Refunds).nullable().optional(),
  udf1: z.string().nullable().optional(),
  udf2: z.string().nullable().optional(),
});

export type GetOrderStatusResponse = z.infer<typeof OrderStatusResponse>;

export function intoOrderStatusResponse(responseData: any): GetOrderStatusResponse {
  try {
    return OrderStatusResponse.parse(responseData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new JsonSchemaError(`Failed to parse order status response`);
    } else {
      throw error;
    }
  }
}

export const ErrorSchema = z.object({
  error_message: z.string().nullable().optional(),
  user_message: z.string().nullable().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorSchema>;

export function intoErrorResponse(eventData: unknown): ErrorResponse {
  try {
    // Try to parse the event data against the schema
    return ErrorSchema.parse(eventData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new JsonSchemaError(`Failed to parse error response: ${eventData}`);
    } else {
      throw error;
    }
  }
}

export const RefundResponseSchema = z.object({
  order_id: z.string(),
  amount: z.number(),
  status: z.string(),
  txn_uuid: z.string().nullable(),
  udf1: z.string().nullable().optional(),
  udf2: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  refunds: z.array(Refunds).nullable().optional(),
});

export type RefundResponse = z.infer<typeof RefundResponseSchema>;

export function intoRefundResponse(responseData: any): RefundResponse {
  try {
    return RefundResponseSchema.parse(responseData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new JsonSchemaError(`Failed to parse refund response`);
    } else {
      throw error;
    }
  }
}

const CaptureMethodEnum = z.enum(["automatic", "manual"]);

const txnDetails = z.object({
  status: z.string(),
  txn_id: z.string(),
  txn_amount: z.number(),
  error_message: z.string(),
});

const erroInfo = z.object({
  user_message: z.string(),
});

const WebhookObjectBodySchema = z.object({
  status: z.string(),
  order_id: z.string(),
  amount: z.number().nullable().optional(),
  txn_uuid: z.string().nullable().optional(),
  refunded: z.boolean().nullable().optional(),
  refunds: z.array(Refunds).nullable().optional(),
  udf1: z.string().nullable().optional(),
  udf2: z.string().nullable().optional(),
  udf3: CaptureMethodEnum.nullable().optional(),
  txn_detail: txnDetails.nullable().optional(),
  error_info: erroInfo.nullable().optional(),
});

const WebhookOrderSchema = z.object({
  order: WebhookObjectBodySchema,
});

const WebhookContentSchema = z.object({
  event_name: z.string(),
  content: WebhookOrderSchema,
});

export type WebhookResponse = z.infer<typeof WebhookContentSchema>;

export type CaptureMethod = z.infer<typeof CaptureMethodEnum>;

export function intoWebhookResponse(responseData: any): WebhookResponse {
  return WebhookContentSchema.parse(responseData);
}
