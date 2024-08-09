import { JsonSchemaError } from "@/errors";
import { TransactionInitializeSessionAddressFragment } from "generated/graphql";
import { z, ZodError } from "zod";
import { type components as paymentsComponents } from "generated/hyperswitch-payments";
import { normalizeValue } from "./payment-app-configuration/utils";
import { env } from "@/lib/env.mjs";
import { randomBytes } from "crypto";

export const getEnvironmentFromKey = (): string => {
  return env.NEXT_PUBLIC_ENV;
};

export function generate16DigitId(): string {
  return randomBytes(8).toString("hex");
}

const AuthenticationTypeEnum = z.enum(["three_ds", "no_three_ds"]);

const AllowedPaymentMethodTypes = z.enum([
  "ach",
  "affirm",
  "afterpay_clearpay",
  "alfamart",
  "ali_pay",
  "ali_pay_hk",
  "alma",
  "apple_pay",
  "atome",
  "bacs",
  "bancontact_card",
  "becs",
  "benefit",
  "bizum",
  "blik",
  "boleto",
  "bca_bank_transfer",
  "bni_va",
  "bri_va",
  "card_redirect",
  "cimb_va",
  "classic",
  "credit",
  "crypto_currency",
  "cashapp",
  "dana",
  "danamon_va",
  "debit",
  "efecty",
  "eps",
  "evoucher",
  "giropay",
  "givex",
  "google_pay",
  "go_pay",
  "gcash",
  "ideal",
  "interac",
  "indomaret",
  "klarna",
  "kakao_pay",
  "mandiri_va",
  "knet",
  "mb_way",
  "mobile_pay",
  "momo",
  "momo_atm",
  "multibanco",
  "online_banking_thailand",
  "online_banking_czech_republic",
  "online_banking_finland",
  "online_banking_fpx",
  "online_banking_poland",
  "online_banking_slovakia",
  "oxxo",
  "pago_efectivo",
  "permata_bank_transfer",
  "open_banking_uk",
  "pay_bright",
  "paypal",
  "pix",
  "pay_safe_card",
  "przelewy24",
  "pse",
  "red_compra",
  "red_pagos",
  "samsung_pay",
  "sepa",
  "sofort",
  "swish",
  "touch_n_go",
  "trustly",
  "twint",
  "upi_collect",
  "upi_intent",
  "vipps",
  "venmo",
  "walley",
  "we_chat_pay",
  "seven_eleven",
  "lawson",
  "mini_stop",
  "family_mart",
  "seicomart",
  "pay_easy",
  "local_bank_transfer",
]);

// Define the schema for PaymentCreateRequest
const PaymentCreateRequestSchema = z.object({
  customerId: z.string().nullable().optional(),
  connector: z.string().nullable().optional(),
  authenticationType: AuthenticationTypeEnum.nullable().optional(),
  billingEmail: z.string().email().nullable().optional(),
  shippingEmail: z.string().email().nullable().optional(),
  statementDescriptorName: z.string().email().nullable().optional(),
  statementDescriptorSuffix: z.string().email().nullable().optional(),
  description: z.string().nullable().optional(),
  returnUrl: z.string().nullable().optional(),
  allowedPaymentMethodTypes: z.array(AllowedPaymentMethodTypes).nullable().optional(),
  manualRetryAllowed: z.boolean().nullable().optional(),
  gatewayReferenceId: z.string().nullable().optional(),
});

// Type definition for PaymentCreateRequest
export type PaymentCreateRequest = z.infer<typeof PaymentCreateRequestSchema>;

// Function to validate the event data
export function validatePaymentCreateRequest(eventData: unknown): PaymentCreateRequest {
  try {
    // Try to parse the event data against the schema
    return PaymentCreateRequestSchema.parse(eventData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new JsonSchemaError(`Failed to parse payment create data: ${error.message}`);
    } else {
      throw error;
    }
  }
}

const buildAddress = (address?: TransactionInitializeSessionAddressFragment) => {
  if (!address) {
    return undefined;
  }
  return {
    line1: address.streetAddress1,
    line2: address.streetAddress2,
    city: address.city,
    state: address.countryArea,
    zip: address.postalCode,
    country: address.country.code as paymentsComponents["schemas"]["CountryAlpha2"],
    first_name: address.firstName,
    last_name: address.lastName,
  };
};

const buildContact = (phoneNumber?: string | null | undefined) => {
  return {
    number: normalizeValue(phoneNumber),
  };
};

export const buildAddressDetails = (
  billingAddress?: TransactionInitializeSessionAddressFragment | null,
  billingEmail?: string | null,
) => {
  if (!billingAddress) {
    return undefined;
  }
  return {
    address: buildAddress(billingAddress),
    phone: buildContact(billingAddress.phone),
    email: normalizeValue(billingEmail),
  };
};
