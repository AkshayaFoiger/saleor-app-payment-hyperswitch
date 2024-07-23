import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { Box, Text } from "@saleor/macaw-ui";
import { AppLayout, AppLayoutRow } from "@/modules/ui/templates/AppLayout";
import { trpcClient } from "@/modules/trpc/trpc-client";
import { getErrorHandler } from "@/modules/trpc/utils";
import { useFetchChannelsQuery } from "generated/graphql";
import { HyperswitchConfigurationsList } from "@/modules/ui/organisms/HyperswitchConfigurationList/HyperswitchConfigurationList";
import { ChannelToConfigurationList } from "@/modules/ui/organisms/ChannelToConfigurationList/ChannelToConfigurationList";
import { Skeleton } from "@/modules/ui/atoms/Skeleton/Skeleton";

function ListConfigurationPage() {
  const { appBridge } = useAppBridge();
  const [allConfigurations, channelMappings] = trpcClient.useQueries((t) => [
    t.hyperswitchConfigurationRouter.paymentConfig.getAll(undefined, {
      onError: getErrorHandler({
        appBridge,
        actionId: "list-all-configurations",
        message: "Error while fetching the list of configurations",
        title: "API Error",
      }),
    }),
    t.hyperswitchConfigurationRouter.mapping.getAll(undefined, {
      onError: getErrorHandler({
        appBridge,
        actionId: "channel-mappings-get-all",
        message: "Error while fetching the channel mappings",
        title: "API Error",
      }),
    }),
    t.juspayConfigurationRouter.paymentConfig.getAll(undefined, {
      onError: getErrorHandler({
        appBridge,
        actionId: "list-all-configurations",
        message: "Error while fetching the list of configurations",
        title: "API Error",
      }),
    }),
    t.juspayConfigurationRouter.mapping.getAll(undefined, {
      onError: getErrorHandler({
        appBridge,
        actionId: "channel-mappings-get-all",
        message: "Error while fetching the channel mappings",
        title: "API Error",
      }),
    }),
  ]);

  const [channels] = useFetchChannelsQuery();

  const hasAnyConfigs = allConfigurations.data && allConfigurations.data.length > 0;
  const hasAnyMappings = Object.values(channelMappings.data || {}).filter(Boolean).length > 0;

  return (
    <AppLayout title="Hyperswitch">
      <AppLayoutRow
        title="Hyperswitch Configurations"
        description="Create Hyperswitch configurations that can be later assigned to Saleor channels."
        disabled={channelMappings.isLoading}
      >
        {allConfigurations.isLoading ? (
          <Skeleton height={40} />
        ) : (
          <HyperswitchConfigurationsList configurations={allConfigurations.data || []} />
        )}
      </AppLayoutRow>
      <AppLayoutRow
        disabled={!hasAnyConfigs || channelMappings.isLoading}
        title="Saleor channel mappings"
        description={
          <Box>
            <Text as="p" size={5}>
              Assign Hypeswitch configurations to Saleor channels.
            </Text>
            {!channelMappings.isLoading && !hasAnyMappings && (
              <Box marginTop={6}>
                <Text as="p" size={5} color="critical2">
                  No channels have configurations assigned.
                </Text>
                <Text as="p" size={5} color="critical2">
                  This means payments are not processed by Hypeswitch.
                </Text>
              </Box>
            )}
          </Box>
        }
      >
        {channelMappings.isLoading ? (
          <Skeleton height={40} />
        ) : (
          <ChannelToConfigurationList
            disabled={!hasAnyConfigs || channelMappings.isLoading}
            configurations={allConfigurations.data || []}
            channelMappings={channelMappings.data || {}}
            channels={channels.data?.channels || []}
          />
        )}
      </AppLayoutRow>
    </AppLayout>
  );
}

export default withAuthorization()(ListConfigurationPage);
