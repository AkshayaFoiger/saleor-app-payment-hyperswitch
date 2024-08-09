import { Box } from "@saleor/macaw-ui";
import { ChipSuccess, ChipHyperswitchOrange, ChipInfo } from "@/modules/ui/atoms/Chip/Chip";
import { getEnvironmentFromKey } from "@/modules/api-utils";
import { appBridgeInstance } from "@/app-bridge-instance";
import { HyperswitchUserVisibleConfigEntry } from "@/modules/payment-app-configuration/hyperswitch-app-configuration/config-entry";
import { JuspayUserVisibleConfigEntry } from "@/modules/payment-app-configuration/juspay-app-configuration/config-entry";
import { env } from "@/lib/env.mjs";

export const HyperswitchConfigurationSummary = ({
  config,
}: {
  config: HyperswitchUserVisibleConfigEntry;
}) => {
  return (
    <Box
      as="dl"
      display="grid"
      __gridTemplateColumns="max-content 1fr"
      rowGap={2}
      columnGap={2}
      alignItems="center"
      margin={0}
    >
      <Box as="dt" marginX={4} fontSize={3} color="default2">
        Environment
      </Box>
      <Box as="dd" marginX={4} textAlign="right">
        {getEnvironmentFromKey() === "production" ? (
          <ChipSuccess>LIVE</ChipSuccess>
        ) : (
          <ChipHyperswitchOrange>TESTING</ChipHyperswitchOrange>
        )}
      </Box>
      <Box as="dt" marginX={4} fontSize={3} color="default2">
        Profile ID
      </Box>
      <Box as="dd" marginX={4} textAlign="right" fontSize={3}>
        <a>{config.profileId}</a>
      </Box>
      <Box as="dt" marginX={4} fontSize={3} color="default2">
        Publishable Key
      </Box>
      <Box as="dd" marginX={4} textAlign="right" fontSize={3}>
        <a>{config.publishableKey}</a>
      </Box>
    </Box>
  );
};

export const JuspayConfigurationSummary = ({
  config,
}: {
  config: JuspayUserVisibleConfigEntry;
}) => {
  return (
    <Box
      as="dl"
      display="grid"
      __gridTemplateColumns="max-content 1fr"
      rowGap={2}
      columnGap={2}
      alignItems="center"
      margin={0}
    >
      <Box as="dt" marginX={4} fontSize={3} color="default2">
        Environment
      </Box>
      <Box as="dd" marginX={4} textAlign="right">
        {getEnvironmentFromKey() === "production" ? (
          <ChipSuccess>LIVE</ChipSuccess>
        ) : (
          <ChipHyperswitchOrange>TESTING</ChipHyperswitchOrange>
        )}
      </Box>
      <Box as="dt" marginX={4} fontSize={3} color="default2">
        Username
      </Box>
      <Box as="dd" marginX={4} textAlign="right" fontSize={3}>
        <a>{config.username}</a>
      </Box>
      <Box as="dt" marginX={4} fontSize={3} color="default2">
        ClientId
      </Box>
      <Box as="dd" marginX={4} textAlign="right" fontSize={3}>
        <a>{config.clientId}</a>
      </Box>
    </Box>
  );
};
